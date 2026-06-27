"""SQLAlchemy ORM models for folders and files."""

from __future__ import annotations

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Folder(Base):
    """A folder that may contain subfolders and files."""

    __tablename__ = "folders"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("folders.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    parent: Mapped[Folder | None] = relationship(
        remote_side="Folder.id",
        back_populates="subfolders",
    )
    subfolders: Mapped[list[Folder]] = relationship(
        back_populates="parent",
        cascade="all, delete-orphan",
    )
    files: Mapped[list[File]] = relationship(
        back_populates="folder",
        cascade="all, delete-orphan",
    )


class File(Base):
    """A file that belongs to a folder."""

    __tablename__ = "files"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    folder_id: Mapped[int | None] = mapped_column(
        ForeignKey("folders.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    folder: Mapped[Folder | None] = relationship(back_populates="files")
