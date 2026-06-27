"""Pydantic schemas for API request and response validation."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# --- Folder schemas ---


class FolderBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    parent_id: int | None = None


class FolderCreate(FolderBase):
    """Request body for POST /folders."""


class FolderUpdate(BaseModel):
    """Request body for partial folder updates (internal use)."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    parent_id: int | None = None


class FolderRead(FolderBase):
    """Folder returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int


# --- File schemas ---


class FileCreateInFolder(BaseModel):
    """Request body for POST /folders/{folder_id}/files."""

    name: str = Field(min_length=1, max_length=255)


class FileCreate(BaseModel):
    """Internal schema used when persisting a file."""

    name: str = Field(min_length=1, max_length=255)
    folder_id: int | None = None


class FileUpdate(BaseModel):
    """Request body for partial file updates (internal use)."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    folder_id: int | None = None


class FileRead(BaseModel):
    """File returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    folder_id: int | None = None


# --- Health ---


class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
