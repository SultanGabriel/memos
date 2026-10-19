package api

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestExtractWhiteboardUIDFromName(t *testing.T) {
	uid, err := ExtractWhiteboardUIDFromName("whiteboards/board-one")
	require.NoError(t, err)
	require.Equal(t, "board-one", uid)
	for _, invalid := range []string{"", "whiteboards/", "memos/board-one", "whiteboards/board/extra"} {
		_, err := ExtractWhiteboardUIDFromName(invalid)
		require.Error(t, err, invalid)
	}
}
