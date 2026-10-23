package api

import (
	"context"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	apipb "github.com/usememos/memos/proto/gen/api"
	"github.com/usememos/memos/store"
)

func (s *APIService) convertWhiteboardFromStore(ctx context.Context, board *store.Whiteboard, includeDocument bool) (*apipb.Whiteboard, error) {
	creator, err := s.Store.GetUser(ctx, &store.FindUser{ID: &board.CreatorID})
	if err != nil || creator == nil {
		return nil, status.Errorf(codes.Internal, "failed to resolve whiteboard creator")
	}
	result := &apipb.Whiteboard{
		Name: "whiteboards/" + board.UID, Creator: BuildUserName(creator.Username), Title: board.Title,
		Tags: board.Tags, State: convertStateFromStore(board.RowStatus),
		BackgroundLayout: board.BackgroundLayout,
		Revision: board.Revision,
		CreateTime: timestamppb.New(time.Unix(board.CreatedTs, 0)),
		UpdateTime: timestamppb.New(time.Unix(board.UpdatedTs, 0)),
	}
	if includeDocument {
		result.Document = string(board.Document)
	}
	if board.ThumbnailAttachmentID != nil {
		attachment, err := s.Store.GetAttachment(ctx, &store.FindAttachment{ID: board.ThumbnailAttachmentID})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to resolve whiteboard thumbnail: %v", err)
		}
		// Attachments remain independently deletable; a missing preview is harmless.
		if attachment != nil {
			result.Thumbnail = AttachmentNamePrefix + attachment.UID
		}
	}
	return result, nil
}
