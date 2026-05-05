"""
Custom exceptions for the Trace2 application.
"""

class TraceNotFound(Exception):
    """
    Raised when traceability data for a material/batch identity is not found.
    """
    def __init__(self, message: str):
        self.message = message
        super().__init__(self.message)
