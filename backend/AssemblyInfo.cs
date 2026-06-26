using System.Runtime.CompilerServices;

// Lets the test project reach internal types (DareDb, entities) to swap the
// database for an isolated in-memory SQLite connection in tests.
[assembly: InternalsVisibleTo("DareApi.Tests")]
