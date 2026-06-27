"""Application-specific exceptions with HTTP status codes and error codes."""


class AppException(Exception):
    """Base exception for predictable API errors."""

    status_code: int = 500
    default_code: str = "INTERNAL_ERROR"

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        details: dict | list | None = None,
    ) -> None:
        self.message = message
        self.code = code or self.default_code
        self.details = details
        super().__init__(message)


class BadRequest(AppException):
    status_code = 400
    default_code = "BAD_REQUEST"


class FolderNotFound(AppException):
    status_code = 404
    default_code = "FOLDER_NOT_FOUND"

    def __init__(self, folder_id: int) -> None:
        super().__init__(
            f"Folder with id {folder_id} not found",
            details={"folder_id": folder_id},
        )


class FileNotFound(AppException):
    status_code = 404
    default_code = "FILE_NOT_FOUND"

    def __init__(self, file_id: int) -> None:
        super().__init__(
            f"File with id {file_id} not found",
            details={"file_id": file_id},
        )


class FileAlreadyExists(AppException):
    status_code = 409
    default_code = "FILE_ALREADY_EXISTS"

    def __init__(self, name: str, folder_id: int) -> None:
        super().__init__(
            f"A file named '{name}' already exists in this folder",
            details={"name": name, "folder_id": folder_id},
        )


class FolderAlreadyExists(AppException):
    status_code = 409
    default_code = "FOLDER_ALREADY_EXISTS"

    def __init__(self, name: str, parent_id: int | None) -> None:
        location = f"folder {parent_id}" if parent_id is not None else "the root"
        super().__init__(
            f"A folder named '{name}' already exists in {location}",
            details={"name": name, "parent_id": parent_id},
        )
