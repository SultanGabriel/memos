package mysql

import (
	"context"
	"database/sql"
	"encoding/json"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/filter"
	"github.com/usememos/memos/store"
)

func (d *DB) CreateWhiteboard(ctx context.Context, create *store.Whiteboard) (*store.Whiteboard, error) {
	create.Revision = 1
	payload, err := json.Marshal(store.WhiteboardPayload{Tags: create.Tags})
	if err != nil {
		return nil, err
	}
	result, err := d.db.ExecContext(ctx, `INSERT INTO whiteboard
		(uid, creator_id, row_status, created_ts, updated_ts, title, payload, document, thumbnail_attachment_id, background_layout)
		VALUES (?, ?, ?, FROM_UNIXTIME(?), FROM_UNIXTIME(?), ?, ?, ?, ?, ?)`,
		create.UID, create.CreatorID, create.RowStatus, create.CreatedTs, create.UpdatedTs,
		create.Title, string(payload), string(create.Document), create.ThumbnailAttachmentID, create.BackgroundLayout)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create whiteboard")
	}
	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}
	create.ID = int32(id)
	return create, nil
}

func (d *DB) ListWhiteboards(ctx context.Context, find *store.FindWhiteboard) ([]*store.Whiteboard, error) {
	where, args := []string{"1 = 1"}, []any{}
	if find.ID != nil {
		where, args = append(where, "whiteboard.id = ?"), append(args, *find.ID)
	}
	if find.UID != nil {
		where, args = append(where, "whiteboard.uid = ?"), append(args, *find.UID)
	}
	if find.CreatorID != nil {
		where, args = append(where, "whiteboard.creator_id = ?"), append(args, *find.CreatorID)
	}
	if find.RowStatus != nil {
		where, args = append(where, "whiteboard.row_status = ?"), append(args, *find.RowStatus)
	}
	engine, err := filter.NewEngine(filter.NewWhiteboardSchema())
	if err != nil {
		return nil, err
	}
	if err := filter.AppendConditions(ctx, engine, find.Filters, filter.DialectMySQL, &where, &args); err != nil {
		return nil, err
	}
	order, err := store.WhiteboardOrderSQL(find.OrderBy)
	if err != nil {
		return nil, err
	}
	document := "document"
	if find.ExcludeDocument {
		document = "'{}'"
	}
	query := `SELECT id, uid, creator_id, row_status, UNIX_TIMESTAMP(created_ts), UNIX_TIMESTAMP(updated_ts), title, payload, `+document+`, thumbnail_attachment_id, background_layout, revision
		FROM whiteboard WHERE `+strings.Join(where, " AND ")+" ORDER BY "+order
	if find.Limit != nil {
		query, args = query+" LIMIT ?", append(args, *find.Limit)
	}
	if find.Offset != nil {
		if find.Limit == nil {
			query += " LIMIT 18446744073709551615"
		}
		query, args = query+" OFFSET ?", append(args, *find.Offset)
	}
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to list whiteboards")
	}
	defer rows.Close()
	result := []*store.Whiteboard{}
	for rows.Next() {
		board := &store.Whiteboard{}
		var payload, document string
		var thumbnail sql.NullInt64
		if err := rows.Scan(&board.ID, &board.UID, &board.CreatorID, &board.RowStatus, &board.CreatedTs,
			&board.UpdatedTs, &board.Title, &payload, &document, &thumbnail, &board.BackgroundLayout, &board.Revision); err != nil {
			return nil, err
		}
		var metadata store.WhiteboardPayload
		if err := json.Unmarshal([]byte(payload), &metadata); err != nil {
			return nil, errors.Wrap(err, "invalid whiteboard payload")
		}
		board.Tags, board.Document = metadata.Tags, json.RawMessage(document)
		board.ThumbnailAttachmentID = store.NullInt32Pointer(thumbnail)
		result = append(result, board)
	}
	return result, rows.Err()
}

func (d *DB) UpdateWhiteboard(ctx context.Context, update *store.UpdateWhiteboard) (*store.Whiteboard, error) {
	if update.ExpectedRevision < 1 {
		return nil, errors.New("positive expected whiteboard revision required")
	}
	set, args := []string{}, []any{}
	if update.BackgroundLayout != nil {
		set, args = append(set, "background_layout = ?"), append(args, *update.BackgroundLayout)
	}
	if update.Title != nil {
		set, args = append(set, "title = ?"), append(args, *update.Title)
	}
	if update.Tags != nil {
		payload, err := json.Marshal(store.WhiteboardPayload{Tags: *update.Tags})
		if err != nil {
			return nil, err
		}
		set, args = append(set, "payload = ?"), append(args, string(payload))
	}
	if update.Document != nil {
		set, args = append(set, "document = ?"), append(args, string(*update.Document))
	}
	if update.RowStatus != nil {
		set, args = append(set, "row_status = ?"), append(args, *update.RowStatus)
	}
	if update.UpdatedTs != nil {
		set, args = append(set, "updated_ts = FROM_UNIXTIME(?)"), append(args, *update.UpdatedTs)
	}
	if update.ClearThumbnail {
		set = append(set, "thumbnail_attachment_id = NULL")
	} else if update.ThumbnailAttachmentID != nil {
		set, args = append(set, "thumbnail_attachment_id = ?"), append(args, *update.ThumbnailAttachmentID)
	}
	set = append(set, "revision = revision + 1")
	query := "UPDATE whiteboard SET "+strings.Join(set, ", ")+" WHERE id = ? AND revision = ?"
	args = append(args, update.ID, update.ExpectedRevision)
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()
	result, err := tx.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to update whiteboard")
	}
	count, err := result.RowsAffected()
	if err != nil {
		return nil, err
	}
	if count == 0 {
		var exists int
		err := tx.QueryRowContext(ctx, "SELECT 1 FROM whiteboard WHERE id = ?", update.ID).Scan(&exists)
		if err == sql.ErrNoRows {
			return nil, store.ErrWhiteboardNotFound
		}
		if err != nil {
			return nil, err
		}
		return nil, store.ErrWhiteboardConflict
	}
	// Read while holding the update lock: never return another writer's revision.
	board := &store.Whiteboard{}
	var payload, document string
	var thumbnail sql.NullInt64
	err = tx.QueryRowContext(ctx, `SELECT id, uid, creator_id, row_status, UNIX_TIMESTAMP(created_ts), UNIX_TIMESTAMP(updated_ts),
		title, payload, document, thumbnail_attachment_id, background_layout, revision
		FROM whiteboard WHERE id = ?`, update.ID).Scan(
		&board.ID, &board.UID, &board.CreatorID, &board.RowStatus, &board.CreatedTs, &board.UpdatedTs,
		&board.Title, &payload, &document, &thumbnail, &board.BackgroundLayout, &board.Revision)
	if err != nil {
		return nil, err
	}
	var metadata store.WhiteboardPayload
	if err := json.Unmarshal([]byte(payload), &metadata); err != nil {
		return nil, errors.Wrap(err, "invalid whiteboard payload")
	}
	board.Tags, board.Document = metadata.Tags, json.RawMessage(document)
	board.ThumbnailAttachmentID = store.NullInt32Pointer(thumbnail)
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return board, nil
}

func (d *DB) DeleteWhiteboard(ctx context.Context, delete *store.DeleteWhiteboard) error {
	_, err := d.db.ExecContext(ctx, "DELETE FROM whiteboard WHERE id = ?", delete.ID)
	return errors.Wrap(err, "failed to delete whiteboard")
}
