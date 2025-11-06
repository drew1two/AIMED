"""Custom exception types for the Context Portal MCP server."""

class ContextPortalError(Exception):
    """Base exception class for Context Portal errors."""
    pass

class DatabaseError(ContextPortalError):
    """Exception raised for database-related errors."""
    pass

class ConfigurationError(ContextPortalError):
    """Exception raised for configuration errors."""
    pass

class ToolArgumentError(ContextPortalError):
    """Exception raised for invalid MCP tool arguments."""
    pass

# Add more specific exceptions as needed