package api

import (
	"context"
	"encoding/json"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	"github.com/usememos/memos/filter"
	apipb "github.com/usememos/memos/proto/gen/api"
	"github.com/usememos/memos/store"
)

func (s *APIService) requireWhiteboardUser(ctx context.Context) (*store.User, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if user == nil || user.RowStatus != store.Normal {
		return nil, status.Errorf(codes.Unauthenticated, "active user required")
	}
	return user, nil
}

func (s *APIService) resolveWhiteboard(ctx context.Context, name string, user *store.User) (*store.Whiteboard, error) {
	uid, err := ExtractWhiteboardUIDFromName(name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid whiteboard name: %v", err)
	}
	board, err := s.Store.GetWhiteboard(ctx, &store.FindWhiteboard{UID: &uid})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get whiteboard: %v", err)
	}
	if board == nil {
		return nil, status.Errorf(codes.NotFound, "whiteboard not found")
	}
	if board.CreatorID != user.ID && user.Role != store.RoleAdmin {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	return board, nil
}

// ListWhiteboards applies collection security before filtering, ordering, and pagination.
func (s *APIService) ListWhiteboards(ctx context.Context, request *apipb.ListWhiteboardsRequest) (*apipb.ListWhiteboardsResponse, error) {
	user, err := s.requireWhiteboardUser(ctx)
	if err != nil {
		return nil, err
	}
	if request == nil {
		return nil, status.Errorf(codes.InvalidArgument, "request required")
	}
	if request.State != apipb.State_STATE_UNSPECIFIED && request.State != apipb.State_NORMAL && request.State != apipb.State_ARCHIVED {
		return nil, status.Errorf(codes.InvalidArgument, "invalid state")
	}
	if _, err := store.WhiteboardOrderSQL(request.OrderBy); err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "%v", err)
	}
	state := convertStateToStore(request.State)
	find := &store.FindWhiteboard{RowStatus: &state, OrderBy: request.OrderBy, ExcludeDocument: true}
	if user.Role != store.RoleAdmin {
		find.CreatorID = &user.ID
	}
	if strings.TrimSpace(request.Filter) != "" {
		engine, err := filter.NewEngine(filter.NewWhiteboardSchema())
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to create filter engine: %v", err)
		}
		if _, err := engine.Compile(ctx, request.Filter); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid filter: %v", err)
		}
		find.Filters = []string{request.Filter}
	}
	limit, offset := normalizePageSize(request.PageSize), 0
	if request.PageToken != "" {
		token := &apipb.PageToken{}
		if err := unmarshalPageToken(request.PageToken, token); err != nil || token.Offset < 0 || token.Limit <= 0 || token.Limit > MaxPageSize {
			return nil, status.Errorf(codes.InvalidArgument, "invalid page token")
		}
		limit, offset = int(token.Limit), int(token.Offset)
	}
	fetchLimit := limit + 1
	find.Limit, find.Offset = &fetchLimit, &offset
	boards, err := s.Store.ListWhiteboards(ctx, find)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list whiteboards: %v", err)
	}
	response := &apipb.ListWhiteboardsResponse{Whiteboards: []*apipb.Whiteboard{}}
	if len(boards) > limit {
		response.NextPageToken, err = getPageToken(limit, offset+limit)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to create page token: %v", err)
		}
		boards = boards[:limit]
	}
	for _, board := range boards {
		converted, err := s.convertWhiteboardFromStore(ctx, board, false)
		if err != nil {
			return nil, err
		}
		response.Whiteboards = append(response.Whiteboards, converted)
	}
	return response, nil
}

// GetWhiteboard returns one authorized board including its document.
func (s *APIService) GetWhiteboard(ctx context.Context, request *apipb.GetWhiteboardRequest) (*apipb.Whiteboard, error) {
	user, err := s.requireWhiteboardUser(ctx)
	if err != nil {
		return nil, err
	}
	board, err := s.resolveWhiteboard(ctx, request.GetName(), user)
	if err != nil {
		return nil, err
	}
	return s.convertWhiteboardFromStore(ctx, board, true)
}

// CreateWhiteboard creates an active board immediately, without a title prompt.
func (s *APIService) CreateWhiteboard(ctx context.Context, request *apipb.CreateWhiteboardRequest) (*apipb.Whiteboard, error) {
	user, err := s.requireWhiteboardUser(ctx)
	if err != nil {
		return nil, err
	}
	if request.GetWhiteboard() == nil {
		return nil, status.Errorf(codes.InvalidArgument, "whiteboard required")
	}
	input := request.Whiteboard
	if input.BackgroundLayout != "" && !store.ValidWhiteboardBackgroundLayout(input.BackgroundLayout) {
		return nil, status.Errorf(codes.InvalidArgument, "invalid background layout")
	}
	if input.Name != "" || input.Creator != "" || input.CreateTime != nil || input.UpdateTime != nil {
		return nil, status.Errorf(codes.InvalidArgument, "name and output fields must be unset")
	}
	if input.State != apipb.State_STATE_UNSPECIFIED && input.State != apipb.State_NORMAL {
		return nil, status.Errorf(codes.InvalidArgument, "new boards must be NORMAL")
	}
	uid, err := ValidateAndGenerateUID(request.WhiteboardId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid whiteboard ID: %v", err)
	}
	document := json.RawMessage(input.Document)
	if strings.TrimSpace(input.Document) == "" {
		document = json.RawMessage(`{}`)
	}
	if err := store.ValidateWhiteboardDocument(document); err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "%v", err)
	}
	thumbnail, err := s.resolveWhiteboardThumbnail(ctx, input.Thumbnail, user, user.ID)
	if err != nil {
		return nil, err
	}
	existing, err := s.Store.GetWhiteboard(ctx, &store.FindWhiteboard{UID: &uid})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to check whiteboard ID: %v", err)
	}
	if existing != nil {
		return nil, status.Errorf(codes.AlreadyExists, "whiteboard ID already exists")
	}
	board, err := s.Store.CreateWhiteboard(ctx, &store.Whiteboard{
		UID: uid, CreatorID: user.ID, Title: input.Title, Tags: input.Tags, Document: document,
		ThumbnailAttachmentID: thumbnail, RowStatus: store.Normal,
		BackgroundLayout: input.BackgroundLayout,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create whiteboard: %v", err)
	}
	return s.convertWhiteboardFromStore(ctx, board, true)
}

// UpdateWhiteboard changes only the named mutable fields.
func (s *APIService) UpdateWhiteboard(ctx context.Context, request *apipb.UpdateWhiteboardRequest) (*apipb.Whiteboard, error) {
	user, err := s.requireWhiteboardUser(ctx)
	if err != nil {
		return nil, err
	}
	if request.GetWhiteboard() == nil || len(request.GetUpdateMask().GetPaths()) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "whiteboard and update_mask required")
	}
	input := request.Whiteboard
	board, err := s.resolveWhiteboard(ctx, input.Name, user)
	if err != nil {
		return nil, err
	}
	update := &store.UpdateWhiteboard{ID: board.ID}
	for _, path := range request.UpdateMask.Paths {
		switch path {
		case "background_layout":
			if !store.ValidWhiteboardBackgroundLayout(input.BackgroundLayout) {
				return nil, status.Errorf(codes.InvalidArgument, "invalid background layout")
			}
			update.BackgroundLayout = &input.BackgroundLayout
		case "title":
			if strings.TrimSpace(input.Title) == "" {
				return nil, status.Errorf(codes.InvalidArgument, "title must not be blank")
			}
			update.Title = &input.Title
		case "tags":
			update.Tags = &input.Tags
		case "document":
			document := json.RawMessage(input.Document)
			if err := store.ValidateWhiteboardDocument(document); err != nil {
				return nil, status.Errorf(codes.InvalidArgument, "%v", err)
			}
			update.Document = &document
		case "thumbnail":
			update.ThumbnailAttachmentID, err = s.resolveWhiteboardThumbnail(ctx, input.Thumbnail, user, board.CreatorID)
			if err != nil {
				return nil, err
			}
			update.ClearThumbnail = update.ThumbnailAttachmentID == nil
		case "state":
			if input.State != apipb.State_NORMAL && input.State != apipb.State_ARCHIVED {
				return nil, status.Errorf(codes.InvalidArgument, "invalid state")
			}
			state := convertStateToStore(input.State)
			update.RowStatus = &state
		default:
			return nil, status.Errorf(codes.InvalidArgument, "field cannot be updated: %s", path)
		}
	}
	if err := s.Store.UpdateWhiteboard(ctx, update); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update whiteboard: %v", err)
	}
	return s.GetWhiteboard(ctx, &apipb.GetWhiteboardRequest{Name: input.Name})
}

// DeleteWhiteboard uses the same permanent deletion convention as DeleteMemo.
func (s *APIService) DeleteWhiteboard(ctx context.Context, request *apipb.DeleteWhiteboardRequest) (*emptypb.Empty, error) {
	user, err := s.requireWhiteboardUser(ctx)
	if err != nil {
		return nil, err
	}
	board, err := s.resolveWhiteboard(ctx, request.GetName(), user)
	if err != nil {
		return nil, err
	}
	if err := s.Store.DeleteWhiteboard(ctx, &store.DeleteWhiteboard{ID: board.ID}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete whiteboard: %v", err)
	}
	return &emptypb.Empty{}, nil
}

// resolveWhiteboardThumbnail keeps previews readable by the board owner under
// the existing unlinked-attachment ACL, including after an administrator edits a board.
func (s *APIService) resolveWhiteboardThumbnail(ctx context.Context, name string, user *store.User, ownerID int32) (*int32, error) {
	if name == "" {
		return nil, nil
	}
	uid, err := ExtractAttachmentUIDFromName(name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid thumbnail name")
	}
	attachment, err := s.Store.GetAttachment(ctx, &store.FindAttachment{UID: &uid})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get thumbnail: %v", err)
	}
	if attachment == nil {
		return nil, status.Errorf(codes.NotFound, "thumbnail attachment not found")
	}
	if attachment.CreatorID != user.ID && user.Role != store.RoleAdmin {
		return nil, status.Errorf(codes.PermissionDenied, "thumbnail is not owned by caller")
	}
	if attachment.CreatorID != ownerID {
		return nil, status.Errorf(codes.InvalidArgument, "thumbnail must be owned by the whiteboard creator")
	}
	if attachment.MemoID != nil || !strings.HasPrefix(attachment.Type, "image/") {
		return nil, status.Errorf(codes.InvalidArgument, "thumbnail must be an unlinked image attachment")
	}
	return &attachment.ID, nil
}
