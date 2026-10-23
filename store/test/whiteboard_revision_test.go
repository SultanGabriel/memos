package test

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestWhiteboardResourceRevision(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	t.Cleanup(func() { ts.Close() })
	owner, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	board, err := ts.CreateWhiteboard(ctx, &store.Whiteboard{UID: "revision-board", CreatorID: owner.ID})
	require.NoError(t, err)
	require.Equal(t, int64(1), board.Revision)
	attachment, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID: "revision-preview", CreatorID: owner.ID, Filename: "preview.png", Type: "image/png",
	})
	require.NoError(t, err)
	title, tags, layout, state := "New title", []string{"work"}, "engineering", store.Archived
	document := json.RawMessage(`{"store":{"opaque":1}}`)
	for _, update := range []*store.UpdateWhiteboard{
		{Title: &title}, {Document: &document}, {Tags: &tags}, {BackgroundLayout: &layout},
		{ThumbnailAttachmentID: &attachment.ID}, {RowStatus: &state},
	} {
		previous := board.Revision
		update.ID, update.ExpectedRevision = board.ID, previous
		board, err = ts.UpdateWhiteboard(ctx, update)
		require.NoError(t, err)
		require.Equal(t, previous+1, board.Revision)
		before, err := ts.GetWhiteboard(ctx, &store.FindWhiteboard{ID: &board.ID})
		require.NoError(t, err)
		// Every field shares the same predicate; rejected writes must change nothing.
		staleTitle, staleTags, staleLayout, staleState := "Stale", []string{"stale"}, "lines", store.Normal
		staleDocument := json.RawMessage(`{"stale":true}`)
		_, err = ts.UpdateWhiteboard(ctx, &store.UpdateWhiteboard{
			ID: board.ID, ExpectedRevision: previous, Title: &staleTitle, Tags: &staleTags,
			Document: &staleDocument, BackgroundLayout: &staleLayout, RowStatus: &staleState, ClearThumbnail: true,
		})
		require.ErrorIs(t, err, store.ErrWhiteboardConflict)
		after, err := ts.GetWhiteboard(ctx, &store.FindWhiteboard{ID: &board.ID})
		require.NoError(t, err)
		require.Equal(t, before, after)
	}
	_, err = ts.UpdateWhiteboard(ctx, &store.UpdateWhiteboard{ID: board.ID, Title: &title})
	require.Error(t, err, "missing preconditions must never turn into unconditional updates")
	require.NoError(t, ts.DeleteWhiteboard(ctx, &store.DeleteWhiteboard{ID: board.ID}))
	_, err = ts.UpdateWhiteboard(ctx, &store.UpdateWhiteboard{ID: board.ID, ExpectedRevision: board.Revision, Title: &title})
	require.ErrorIs(t, err, store.ErrWhiteboardNotFound)
}

func TestWhiteboardRevisionHasOneConcurrentWinner(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	t.Cleanup(func() { ts.Close() })
	owner, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	board, err := ts.CreateWhiteboard(ctx, &store.Whiteboard{UID: "concurrent-board", CreatorID: owner.ID})
	require.NoError(t, err)
	start := make(chan struct{})
	results := make(chan error, 2)
	for _, title := range []string{"First", "Second"} {
		go func() {
			<-start
			_, err := ts.UpdateWhiteboard(ctx, &store.UpdateWhiteboard{ID: board.ID, ExpectedRevision: 1, Title: &title})
			results <- err
		}()
	}
	close(start)
	winners := 0
	for range 2 {
		err := <-results
		if err == nil {
			winners++
		} else {
			require.ErrorIs(t, err, store.ErrWhiteboardConflict)
		}
	}
	require.Equal(t, 1, winners)
	got, err := ts.GetWhiteboard(ctx, &store.FindWhiteboard{ID: &board.ID})
	require.NoError(t, err)
	require.Equal(t, int64(2), got.Revision)
}
