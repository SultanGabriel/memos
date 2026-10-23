package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	apipb "github.com/usememos/memos/proto/gen/api"
)

func TestWhiteboardRevisionPrecondition(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	t.Cleanup(ts.Cleanup)
	owner, err := ts.CreateRegularUser(ctx, "revision-owner")
	require.NoError(t, err)
	ctx = ts.CreateUserContext(ctx, owner.ID)
	board, err := ts.Service.CreateWhiteboard(ctx, &apipb.CreateWhiteboardRequest{Whiteboard: &apipb.Whiteboard{}})
	require.NoError(t, err)
	require.Equal(t, int64(1), board.Revision)
	updated, err := ts.Service.UpdateWhiteboard(ctx, &apipb.UpdateWhiteboardRequest{
		Whiteboard: &apipb.Whiteboard{Name: board.Name, Title: "New title"}, ExpectedRevision: 1,
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"title"}},
	})
	require.NoError(t, err)
	require.Equal(t, int64(2), updated.Revision)
	_, err = ts.Service.UpdateWhiteboard(ctx, &apipb.UpdateWhiteboardRequest{
		Whiteboard: &apipb.Whiteboard{Name: board.Name, Title: "Stale", Document: `{"stale":true}`}, ExpectedRevision: 1,
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"title", "document"}},
	})
	require.Equal(t, codes.FailedPrecondition, status.Code(err))
	got, err := ts.Service.GetWhiteboard(ctx, &apipb.GetWhiteboardRequest{Name: board.Name})
	require.NoError(t, err)
	require.Equal(t, updated.Title, got.Title)
	require.JSONEq(t, board.Document, got.Document)
	require.Equal(t, int64(2), got.Revision)
	updated, err = ts.Service.UpdateWhiteboard(ctx, &apipb.UpdateWhiteboardRequest{
		Whiteboard: &apipb.Whiteboard{Name: board.Name, Tags: []string{"work"}, BackgroundLayout: "graph"}, ExpectedRevision: got.Revision,
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"tags", "background_layout"}},
	})
	require.NoError(t, err)
	require.Equal(t, int64(3), updated.Revision)
	_, err = ts.Service.UpdateWhiteboard(ctx, &apipb.UpdateWhiteboardRequest{
		Whiteboard: &apipb.Whiteboard{Name: board.Name, Title: "Missing precondition"},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"title"}},
	})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	_, err = ts.Service.DeleteWhiteboard(ctx, &apipb.DeleteWhiteboardRequest{Name: board.Name})
	require.NoError(t, err)
	_, err = ts.Service.UpdateWhiteboard(ctx, &apipb.UpdateWhiteboardRequest{
		Whiteboard: &apipb.Whiteboard{Name: board.Name, Title: "Gone"}, ExpectedRevision: updated.Revision,
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"title"}},
	})
	require.Equal(t, codes.NotFound, status.Code(err))
}
