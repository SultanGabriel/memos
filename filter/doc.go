// Package filter compiles the CEL filter expressions accepted by the list
// endpoints into an intermediate representation and renders that IR into SQL
// for each database driver. Independent memo, attachment, and whiteboard
// schemas define which fields each resource exposes.
//
// Layering: filter imports only third-party packages and internal. It must not
// import store, core, or server; the SQL drivers import filter, not the other
// way round.
package filter
