package filter

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestWhiteboardFiltersUseIndependentSchema(t *testing.T) {
	engine, err := NewEngine(NewWhiteboardSchema())
	require.NoError(t, err)
	for _, dialect := range []DialectName{DialectSQLite, DialectMySQL, DialectPostgres} {
		t.Run(string(dialect), func(t *testing.T) {
			stmt, err := engine.CompileToStatement(context.Background(), `title.contains("plan") && "work" in tags`, RenderOptions{
				Dialect: dialect, PlaceholderOffset: 2,
			})
			require.NoError(t, err)
			// Normalize identifier quoting across SQLite, MySQL, and PostgreSQL.
			sql := strings.NewReplacer("`", "", "\"", "").Replace(stmt.SQL)
			require.Regexp(t, `(?i)\bwhiteboard\s*\.\s*title\b`, sql)
			require.Regexp(t, `(?i)\bwhiteboard\s*\.\s*payload\b`, sql)
			require.NotRegexp(t, `(?i)\bmemo\s*\.`, sql, "filter must not reference memo columns")
			require.NotRegexp(t, `(?i)\b(?:from|join)\s+(?:\w+\s*\.\s*)?memo\b`, sql, "filter must not query the memo table")
			require.NotEmpty(t, stmt.Args)
		})
	}
	_, err = engine.Compile(context.Background(), `visibility == "PUBLIC"`)
	require.Error(t, err, "memo visibility must not be available to whiteboard queries")
}
