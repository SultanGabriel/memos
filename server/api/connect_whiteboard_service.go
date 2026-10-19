package api

import (
	"context"

	"connectrpc.com/connect"
	"google.golang.org/protobuf/types/known/emptypb"

	apipb "github.com/usememos/memos/proto/gen/api"
)

func (s *ConnectServiceHandler) ListWhiteboards(ctx context.Context, req *connect.Request[apipb.ListWhiteboardsRequest]) (*connect.Response[apipb.ListWhiteboardsResponse], error) {
	resp, err := s.APIService.ListWhiteboards(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) GetWhiteboard(ctx context.Context, req *connect.Request[apipb.GetWhiteboardRequest]) (*connect.Response[apipb.Whiteboard], error) {
	resp, err := s.APIService.GetWhiteboard(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) CreateWhiteboard(ctx context.Context, req *connect.Request[apipb.CreateWhiteboardRequest]) (*connect.Response[apipb.Whiteboard], error) {
	resp, err := s.APIService.CreateWhiteboard(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) UpdateWhiteboard(ctx context.Context, req *connect.Request[apipb.UpdateWhiteboardRequest]) (*connect.Response[apipb.Whiteboard], error) {
	resp, err := s.APIService.UpdateWhiteboard(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) DeleteWhiteboard(ctx context.Context, req *connect.Request[apipb.DeleteWhiteboardRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIService.DeleteWhiteboard(ctx, req.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}
