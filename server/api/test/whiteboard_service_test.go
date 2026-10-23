package test

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	apipb "github.com/usememos/memos/proto/gen/api"
	"github.com/usememos/memos/store"
)

func TestWhiteboardServiceAuthorization(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	t.Cleanup(ts.Cleanup)
	owner, err := ts.CreateRegularUser(ctx, "board-owner")
	require.NoError(t, err)
	other, err := ts.CreateRegularUser(ctx, "board-other")
	require.NoError(t, err)
	admin, err := ts.CreateHostUser(ctx, "board-admin")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)

	for _, actor := range []struct {
		name string
		ctx  context.Context
		code codes.Code
	}{
		{"creator", ownerCtx, codes.OK},
		{"other user", ts.CreateUserContext(ctx, other.ID), codes.PermissionDenied},
		{"admin", ts.CreateUserContext(ctx, admin.ID), codes.OK},
		{"anonymous", ctx, codes.Unauthenticated},
	} {
		t.Run(actor.name, func(t *testing.T) {
			board, err := ts.Service.CreateWhiteboard(ownerCtx, &apipb.CreateWhiteboardRequest{Whiteboard: &apipb.Whiteboard{}})
			require.NoError(t, err)
			require.Regexp(t, `^whiteboards/[^/]+$`, board.Name)
			require.Equal(t, "users/"+owner.Username, board.Creator)
			require.Equal(t, "Untitled Whiteboard", board.Title)
			require.Equal(t, apipb.State_NORMAL, board.State)
			require.Equal(t, int64(1), board.Revision)
			require.NotNil(t, board.CreateTime)
			require.NotNil(t, board.UpdateTime)

			got, err := ts.Service.GetWhiteboard(actor.ctx, &apipb.GetWhiteboardRequest{Name: board.Name})
			require.Equal(t, actor.code, status.Code(err))
			if actor.code == codes.OK {
				require.Equal(t, board.Name, got.Name)
			}
			updated, err := ts.Service.UpdateWhiteboard(actor.ctx, &apipb.UpdateWhiteboardRequest{
				ExpectedRevision: board.Revision,
				Whiteboard: &apipb.Whiteboard{Name: board.Name, Title: "Changed", BackgroundLayout: "lines"},
				UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"title", "background_layout"}},
			})
			require.Equal(t, actor.code, status.Code(err))
			if actor.code == codes.OK {
				require.Equal(t, "Changed", updated.Title)
				require.Equal(t, "lines", updated.BackgroundLayout)
				require.Equal(t, board.Creator, updated.Creator)
			}
			_, err = ts.Service.DeleteWhiteboard(actor.ctx, &apipb.DeleteWhiteboardRequest{Name: board.Name})
			require.Equal(t, actor.code, status.Code(err))
			got, err = ts.Service.GetWhiteboard(ownerCtx, &apipb.GetWhiteboardRequest{Name: board.Name})
			if actor.code == codes.OK {
				require.Equal(t, codes.NotFound, status.Code(err))
			} else {
				require.NoError(t, err)
				require.Equal(t, "Untitled Whiteboard", got.Title, "denied writes must leave the board unchanged")
			}
		})
	}
	_, err = ts.Service.CreateWhiteboard(ctx, &apipb.CreateWhiteboardRequest{Whiteboard: &apipb.Whiteboard{}})
	require.Equal(t, codes.Unauthenticated, status.Code(err))
}

func TestWhiteboardBackgroundMetadata(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	t.Cleanup(ts.Cleanup)
	owner, err := ts.CreateRegularUser(ctx, "background-owner")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, owner.ID)
	board, err := ts.Service.CreateWhiteboard(userCtx, &apipb.CreateWhiteboardRequest{Whiteboard: &apipb.Whiteboard{}})
	require.NoError(t, err)
	require.Equal(t, "blank", board.BackgroundLayout)
	for _, layout := range []string{"lines", "engineering", "graph", "isometric", "blank"} {
		updated, err := ts.Service.UpdateWhiteboard(userCtx, &apipb.UpdateWhiteboardRequest{
			ExpectedRevision: board.Revision,
			Whiteboard: &apipb.Whiteboard{Name: board.Name, BackgroundLayout: layout, Document: `{"unmasked":true}`},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"background_layout"}},
		})
		require.NoError(t, err)
		require.Equal(t, layout, updated.BackgroundLayout)
		require.JSONEq(t, board.Document, updated.Document)
		board.Revision = updated.Revision
	}
	for _, layout := range []string{"", "unsupported"} {
		_, err := ts.Service.UpdateWhiteboard(userCtx, &apipb.UpdateWhiteboardRequest{
			ExpectedRevision: board.Revision,
			Whiteboard: &apipb.Whiteboard{Name: board.Name, BackgroundLayout: layout},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"background_layout"}},
		})
		require.Equal(t, codes.InvalidArgument, status.Code(err))
	}
	created, err := ts.Service.CreateWhiteboard(userCtx, &apipb.CreateWhiteboardRequest{
		Whiteboard: &apipb.Whiteboard{BackgroundLayout: "graph"},
	})
	require.NoError(t, err)
	updated, err := ts.Service.UpdateWhiteboard(userCtx, &apipb.UpdateWhiteboardRequest{
		ExpectedRevision: created.Revision,
		Whiteboard: &apipb.Whiteboard{Name: created.Name, Title: "Renamed", BackgroundLayout: "lines"},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"title"}},
	})
	require.NoError(t, err)
	require.Equal(t, "graph", updated.BackgroundLayout)
	listed, err := ts.Service.ListWhiteboards(userCtx, &apipb.ListWhiteboardsRequest{})
	require.NoError(t, err)
	for _, item := range listed.Whiteboards {
		if item.Name == created.Name {
			require.Equal(t, "graph", item.BackgroundLayout)
		}
	}
	_, err = ts.Service.CreateWhiteboard(userCtx, &apipb.CreateWhiteboardRequest{
		Whiteboard: &apipb.Whiteboard{BackgroundLayout: "unsupported"},
	})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
}

func TestWhiteboardServiceCollection(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	t.Cleanup(ts.Cleanup)
	owner, err := ts.CreateRegularUser(ctx, "board-list-owner")
	require.NoError(t, err)
	other, err := ts.CreateRegularUser(ctx, "board-list-other")
	require.NoError(t, err)
	admin, err := ts.CreateHostUser(ctx, "board-list-admin")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)
	adminCtx := ts.CreateUserContext(ctx, admin.ID)

	// Fixed distinct timestamps avoid clock sleeps and exercise the service's default order.
	for _, fixture := range []struct {
		uid     string
		creator int32
		title   string
		tags    []string
		updated int64
		state   store.RowStatus
	}{
		{"board-old", owner.ID, "Garden plan", []string{"garden"}, 100, store.Normal},
		{"board-new", owner.ID, "Office plan", []string{"work"}, 300, store.Normal},
		{"board-hidden", other.ID, "Office private", []string{"work"}, 500, store.Normal},
		{"board-archive", owner.ID, "Office archive", []string{"work"}, 700, store.Archived},
	} {
		_, err := ts.Store.CreateWhiteboard(ctx, &store.Whiteboard{
			UID: fixture.uid, CreatorID: fixture.creator, Title: fixture.title,
			Tags: fixture.tags, Document: []byte(`{}`), RowStatus: fixture.state,
			CreatedTs: 50, UpdatedTs: fixture.updated,
		})
		require.NoError(t, err)
	}
	names := func(boards []*apipb.Whiteboard) []string {
		result := make([]string, 0, len(boards))
		for _, board := range boards {
			result = append(result, board.Name)
		}
		return result
	}
	feed, err := ts.Service.ListWhiteboards(ownerCtx, &apipb.ListWhiteboardsRequest{})
	require.NoError(t, err)
	require.Equal(t, []string{"whiteboards/board-new", "whiteboards/board-old"}, names(feed.Whiteboards))

	// Dedicated whiteboard CEL fields follow existing string/list filter conventions.
	for _, filter := range []string{`title.contains("Office")`, `"work" in tags`} {
		feed, err := ts.Service.ListWhiteboards(ownerCtx, &apipb.ListWhiteboardsRequest{Filter: filter})
		require.NoError(t, err)
		require.Equal(t, []string{"whiteboards/board-new"}, names(feed.Whiteboards))
	}
	feed, err = ts.Service.ListWhiteboards(adminCtx, &apipb.ListWhiteboardsRequest{})
	require.NoError(t, err)
	require.Equal(t, []string{"whiteboards/board-hidden", "whiteboards/board-new", "whiteboards/board-old"}, names(feed.Whiteboards))
	_, err = ts.Service.ListWhiteboards(ctx, &apipb.ListWhiteboardsRequest{})
	require.Equal(t, codes.Unauthenticated, status.Code(err))
	page, err := ts.Service.ListWhiteboards(ownerCtx, &apipb.ListWhiteboardsRequest{PageSize: 1})
	require.NoError(t, err)
	require.Len(t, page.Whiteboards, 1)
	require.Equal(t, "whiteboards/board-new", page.Whiteboards[0].Name)
	require.Empty(t, page.Whiteboards[0].Document, "list responses must omit snapshots")
	require.NotEmpty(t, page.NextPageToken)
	page, err = ts.Service.ListWhiteboards(ownerCtx, &apipb.ListWhiteboardsRequest{PageToken: page.NextPageToken})
	require.NoError(t, err)
	require.Equal(t, []string{"whiteboards/board-old"}, names(page.Whiteboards))
	require.Empty(t, page.NextPageToken)
	_, err = ts.Service.ListWhiteboards(ownerCtx, &apipb.ListWhiteboardsRequest{Filter: `visibility == "PUBLIC"`})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	_, err = ts.Service.ListWhiteboards(ownerCtx, &apipb.ListWhiteboardsRequest{OrderBy: "title; DROP TABLE whiteboard"})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
}

func TestWhiteboardServiceMaskedUpdatesAndThumbnails(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	t.Cleanup(ts.Cleanup)
	owner, err := ts.CreateRegularUser(ctx, "board-thumbnail-owner")
	require.NoError(t, err)
	other, err := ts.CreateRegularUser(ctx, "board-thumbnail-other")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, owner.ID)
	board, err := ts.Service.CreateWhiteboard(userCtx, &apipb.CreateWhiteboardRequest{Whiteboard: &apipb.Whiteboard{}})
	require.NoError(t, err)
	first, err := ts.Store.CreateAttachment(ctx, &store.Attachment{
		UID: "board-preview-a", CreatorID: owner.ID, Filename: "a.png", Type: "image/png",
	})
	require.NoError(t, err)
	second, err := ts.Store.CreateAttachment(ctx, &store.Attachment{
		UID: "board-preview-b", CreatorID: owner.ID, Filename: "b.png", Type: "image/png",
	})
	require.NoError(t, err)
	foreign, err := ts.Store.CreateAttachment(ctx, &store.Attachment{
		UID: "board-preview-foreign", CreatorID: other.ID, Filename: "foreign.png", Type: "image/png",
	})
	require.NoError(t, err)

	document := `{"store":{},"schema":{"schemaVersion":2}}`
	updated, err := ts.Service.UpdateWhiteboard(userCtx, &apipb.UpdateWhiteboardRequest{
		Whiteboard: &apipb.Whiteboard{Name: board.Name, Title: "Plan", Tags: []string{" work ", "", "work", "Work"}, Document: document},
		ExpectedRevision: board.Revision,
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"title", "tags", "document"}},
	})
	require.NoError(t, err)
	require.Equal(t, []string{"work", "Work"}, updated.Tags)
	require.JSONEq(t, document, updated.Document)
	for _, attachment := range []*store.Attachment{first, second} {
		updated, err = ts.Service.UpdateWhiteboard(userCtx, &apipb.UpdateWhiteboardRequest{
			ExpectedRevision: updated.Revision,
			Whiteboard: &apipb.Whiteboard{Name: board.Name, Title: "unmasked", Thumbnail: "attachments/"+attachment.UID},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"thumbnail"}},
		})
		require.NoError(t, err)
		require.Equal(t, "attachments/"+attachment.UID, updated.Thumbnail)
		require.Equal(t, "Plan", updated.Title)
		require.JSONEq(t, document, updated.Document)
	}
	_, err = ts.Service.UpdateWhiteboard(userCtx, &apipb.UpdateWhiteboardRequest{
		Whiteboard: &apipb.Whiteboard{Name: board.Name, Thumbnail: "attachments/"+foreign.UID},
		ExpectedRevision: updated.Revision,
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"thumbnail"}},
	})
	require.Equal(t, codes.PermissionDenied, status.Code(err))
	for _, path := range []string{"creator", "name", "create_time", "update_time", "*"} {
		_, err := ts.Service.UpdateWhiteboard(userCtx, &apipb.UpdateWhiteboardRequest{
			Whiteboard: &apipb.Whiteboard{Name: board.Name}, UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{path}},
			ExpectedRevision: board.Revision,
		})
		require.Equal(t, codes.InvalidArgument, status.Code(err), path)
	}
	_, err = ts.Service.UpdateWhiteboard(userCtx, &apipb.UpdateWhiteboardRequest{
		Whiteboard: &apipb.Whiteboard{Name: board.Name, Document: "null"},
		ExpectedRevision: board.Revision,
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"document"}},
	})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	updated, err = ts.Service.GetWhiteboard(userCtx, &apipb.GetWhiteboardRequest{Name: board.Name})
	require.NoError(t, err)
	require.Equal(t, "attachments/"+second.UID, updated.Thumbnail, "failed updates preserve the current thumbnail")
	updated, err = ts.Service.UpdateWhiteboard(userCtx, &apipb.UpdateWhiteboardRequest{
		Whiteboard: &apipb.Whiteboard{Name: board.Name}, UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"thumbnail"}},
		ExpectedRevision: updated.Revision,
	})
	require.NoError(t, err)
	require.Empty(t, updated.Thumbnail)
	for _, attachment := range []*store.Attachment{first, second} {
		got, err := ts.Store.GetAttachment(ctx, &store.FindAttachment{ID: &attachment.ID})
		require.NoError(t, err)
		require.NotNil(t, got, "thumbnail replacement does not delete attachments")
	}
	// The Go backend validates the envelope, not third-party drawing record semantics.
	require.True(t, json.Valid([]byte(updated.Document)))
}
