package test

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

// IDs follow the existing int32 store identity convention; documents are opaque JSON.
func TestWhiteboardStoreLifecycle(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	t.Cleanup(func() { ts.Close() })
	owner, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	board, err := ts.CreateWhiteboard(ctx, &store.Whiteboard{
		UID: "board-one", CreatorID: owner.ID, Title: "Sketch", Tags: []string{"work"},
		Document: json.RawMessage(`{"store":{},"schema":{"schemaVersion":2}}`),
	})
	require.NoError(t, err)
	require.Positive(t, board.ID)
	require.Equal(t, "board-one", board.UID)
	require.Equal(t, owner.ID, board.CreatorID)
	require.Equal(t, store.Normal, board.RowStatus)
	require.Positive(t, board.CreatedTs)
	require.GreaterOrEqual(t, board.UpdatedTs, board.CreatedTs)
	require.Nil(t, board.ThumbnailAttachmentID)
	require.Equal(t, "blank", board.BackgroundLayout)
	require.Equal(t, int64(1), board.Revision)
	revision := board.Revision
	apply := func(update *store.UpdateWhiteboard) error {
		update.ExpectedRevision = revision
		updated, err := ts.UpdateWhiteboard(ctx, update)
		if err == nil {
			revision = updated.Revision
		}
		return err
	}

	byID, err := ts.GetWhiteboard(ctx, &store.FindWhiteboard{ID: &board.ID})
	require.NoError(t, err)
	require.NotNil(t, byID)
	require.JSONEq(t, string(board.Document), string(byID.Document))
	// PostgreSQL JSONB and MySQL JSON may canonicalize whitespace and key order.
	byID.Document = board.Document
	require.Equal(t, board, byID)
	byUID, err := ts.GetWhiteboard(ctx, &store.FindWhiteboard{UID: &board.UID})
	require.NoError(t, err)
	require.NotNil(t, byUID)
	require.JSONEq(t, string(board.Document), string(byUID.Document))
	byUID.Document = board.Document
	require.Equal(t, board, byUID)

	first, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID: "preview-one", CreatorID: owner.ID, Filename: "one.png", Type: "image/png",
	})
	require.NoError(t, err)
	second, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID: "preview-two", CreatorID: owner.ID, Filename: "two.png", Type: "image/png",
	})
	require.NoError(t, err)
	title, tags := "Revised sketch", []string{"work", "ideas"}
	document := json.RawMessage(`{"store":{"opaque":{"value":42}},"schema":{"schemaVersion":2}}`)
	updatedTs := board.UpdatedTs + 10
	require.NoError(t, apply(&store.UpdateWhiteboard{
		ID: board.ID, Title: &title, Tags: &tags, Document: &document,
		ThumbnailAttachmentID: &first.ID, UpdatedTs: &updatedTs,
	}))
	got, err := ts.GetWhiteboard(ctx, &store.FindWhiteboard{ID: &board.ID})
	require.NoError(t, err)
	require.NotNil(t, got)
	require.Equal(t, board.ID, got.ID)
	require.Equal(t, board.UID, got.UID)
	require.Equal(t, owner.ID, got.CreatorID)
	require.Equal(t, board.CreatedTs, got.CreatedTs)
	require.Equal(t, updatedTs, got.UpdatedTs)
	require.Equal(t, title, got.Title)
	require.Equal(t, tags, got.Tags)
	require.JSONEq(t, string(document), string(got.Document))
	require.Equal(t, &first.ID, got.ThumbnailAttachmentID)
	for _, layout := range []string{"lines", "engineering", "graph", "isometric", "blank"} {
		require.NoError(t, apply(&store.UpdateWhiteboard{ID: board.ID, BackgroundLayout: &layout}))
		got, err := ts.GetWhiteboard(ctx, &store.FindWhiteboard{ID: &board.ID})
		require.NoError(t, err)
		require.Equal(t, layout, got.BackgroundLayout)
		require.Equal(t, tags, got.Tags)
		require.JSONEq(t, string(document), string(got.Document))
	}
	invalidLayout := "unsupported"
	require.Error(t, apply(&store.UpdateWhiteboard{ID: board.ID, BackgroundLayout: &invalidLayout}))

	// Replacement only changes the reference; attachment cleanup belongs to the client.
	require.NoError(t, apply(&store.UpdateWhiteboard{ID: board.ID, ThumbnailAttachmentID: &second.ID}))
	got, err = ts.GetWhiteboard(ctx, &store.FindWhiteboard{ID: &board.ID})
	require.NoError(t, err)
	require.NotNil(t, got)
	require.Equal(t, &second.ID, got.ThumbnailAttachmentID)
	oldPreview, err := ts.GetAttachment(ctx, &store.FindAttachment{ID: &first.ID})
	require.NoError(t, err)
	require.NotNil(t, oldPreview)

	// Archiving and deletion are distinct in Memos. A NORMAL query excludes archives.
	archived, normal := store.Archived, store.Normal
	require.NoError(t, apply(&store.UpdateWhiteboard{ID: board.ID, RowStatus: &archived}))
	active, err := ts.ListWhiteboards(ctx, &store.FindWhiteboard{CreatorID: &owner.ID, RowStatus: &normal})
	require.NoError(t, err)
	require.Empty(t, active)
	archives, err := ts.ListWhiteboards(ctx, &store.FindWhiteboard{CreatorID: &owner.ID, RowStatus: &archived})
	require.NoError(t, err)
	require.Len(t, archives, 1)
	require.Equal(t, board.ID, archives[0].ID)
	require.NoError(t, ts.DeleteWhiteboard(ctx, &store.DeleteWhiteboard{ID: board.ID}))
	got, err = ts.GetWhiteboard(ctx, &store.FindWhiteboard{ID: &board.ID})
	require.NoError(t, err)
	require.Nil(t, got)
	preview, err := ts.GetAttachment(ctx, &store.FindAttachment{ID: &second.ID})
	require.NoError(t, err)
	require.NotNil(t, preview, "board deletion must preserve ordinary unlinked attachments")
}

func TestDeleteUserRemovesOwnedWhiteboards(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	t.Cleanup(func() { ts.Close() })
	owner, err := createTestingUserWithRole(ctx, ts, "deleted-board-owner", store.RoleUser)
	require.NoError(t, err)
	other, err := createTestingUserWithRole(ctx, ts, "retained-board-owner", store.RoleUser)
	require.NoError(t, err)
	board, err := ts.CreateWhiteboard(ctx, &store.Whiteboard{UID: "removed-board", CreatorID: owner.ID})
	require.NoError(t, err)
	kept, err := ts.CreateWhiteboard(ctx, &store.Whiteboard{UID: "retained-board", CreatorID: other.ID})
	require.NoError(t, err)
	_, err = ts.DeleteUser(ctx, &store.DeleteUser{ID: owner.ID})
	require.NoError(t, err)
	got, err := ts.GetWhiteboard(ctx, &store.FindWhiteboard{ID: &board.ID})
	require.NoError(t, err)
	require.Nil(t, got)
	got, err = ts.GetWhiteboard(ctx, &store.FindWhiteboard{ID: &kept.ID})
	require.NoError(t, err)
	require.NotNil(t, got)
}
