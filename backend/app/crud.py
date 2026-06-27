"""Database access functions for folders and files."""

from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app import models, schemas
from app.exceptions import FileAlreadyExists, FileNotFound, FolderAlreadyExists, FolderNotFound


def _apply_partial_update(instance: object, update: BaseModel) -> None:
    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(instance, field, value)


def _commit(db: Session) -> None:
    """Commit the current transaction, rolling back on failure."""
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise


# --- Folders ---


def get_folder(db: Session, folder_id: int) -> models.Folder | None:
    return db.get(models.Folder, folder_id)


def get_folder_or_raise(db: Session, folder_id: int) -> models.Folder:
    folder = get_folder(db, folder_id)
    if folder is None:
        raise FolderNotFound(folder_id)
    return folder


def get_folders(
    db: Session,
    *,
    parent_id: int | None = None,
    skip: int = 0,
    limit: int | None = None,
) -> list[models.Folder]:
    stmt = select(models.Folder).order_by(models.Folder.name)
    if parent_id is not None:
        stmt = stmt.where(models.Folder.parent_id == parent_id)
    stmt = stmt.offset(skip)
    if limit is not None:
        stmt = stmt.limit(limit)
    return list(db.scalars(stmt))


def _folder_name_exists(
    db: Session, name: str, parent_id: int | None, *, exclude_id: int | None = None
) -> bool:
    stmt = select(models.Folder.id).where(
        func.lower(models.Folder.name) == name.lower(),
        models.Folder.parent_id == parent_id,
    )
    if exclude_id is not None:
        stmt = stmt.where(models.Folder.id != exclude_id)
    return db.scalar(stmt) is not None


def create_folder(db: Session, folder_in: schemas.FolderCreate) -> models.Folder:
    if folder_in.parent_id is not None:
        get_folder_or_raise(db, folder_in.parent_id)

    if _folder_name_exists(db, folder_in.name, folder_in.parent_id):
        raise FolderAlreadyExists(folder_in.name, folder_in.parent_id)

    folder = models.Folder(**folder_in.model_dump())
    db.add(folder)
    _commit(db)
    db.refresh(folder)
    return folder


def update_folder(
    db: Session,
    folder: models.Folder,
    folder_in: schemas.FolderUpdate,
) -> models.Folder:
    _apply_partial_update(folder, folder_in)
    _commit(db)
    db.refresh(folder)
    return folder


def delete_folder(db: Session, folder_id: int) -> models.Folder:
    folder = get_folder_or_raise(db, folder_id)
    db.delete(folder)
    _commit(db)
    return folder


# --- Files ---


def get_file(db: Session, file_id: int) -> models.File | None:
    return db.get(models.File, file_id)


def get_file_or_raise(db: Session, file_id: int) -> models.File:
    file = get_file(db, file_id)
    if file is None:
        raise FileNotFound(file_id)
    return file


def get_files(
    db: Session,
    *,
    folder_id: int | None = None,
    skip: int = 0,
    limit: int | None = None,
) -> list[models.File]:
    stmt = select(models.File).order_by(models.File.name)
    if folder_id is not None:
        stmt = stmt.where(models.File.folder_id == folder_id)
    stmt = stmt.offset(skip)
    if limit is not None:
        stmt = stmt.limit(limit)
    return list(db.scalars(stmt))


def _file_name_exists_in_folder(db: Session, name: str, folder_id: int) -> bool:
    return (
        db.scalar(
            select(models.File.id).where(
                func.lower(models.File.name) == name.lower(),
                models.File.folder_id == folder_id,
            )
        )
        is not None
    )


def create_file(db: Session, file_in: schemas.FileCreate) -> models.File:
    if file_in.folder_id is not None:
        get_folder_or_raise(db, file_in.folder_id)
        if _file_name_exists_in_folder(db, file_in.name, file_in.folder_id):
            raise FileAlreadyExists(file_in.name, file_in.folder_id)

    file = models.File(**file_in.model_dump())
    db.add(file)
    _commit(db)
    db.refresh(file)
    return file


def update_file(
    db: Session,
    file: models.File,
    file_in: schemas.FileUpdate,
) -> models.File:
    _apply_partial_update(file, file_in)
    _commit(db)
    db.refresh(file)
    return file


def delete_file(db: Session, file_id: int) -> models.File:
    file = get_file_or_raise(db, file_id)
    db.delete(file)
    _commit(db)
    return file


def search_files(
    db: Session,
    *,
    query: str,
    folder_id: int | None = None,
    limit: int = 10,
) -> list[models.File]:
    """Return files whose names start with `query` (case-insensitive)."""
    if folder_id is not None:
        get_folder_or_raise(db, folder_id)

    stmt = (
        select(models.File)
        .where(models.File.name.ilike(f"{query}%"))
        .order_by(models.File.name)
        .limit(limit)
    )
    if folder_id is not None:
        stmt = stmt.where(models.File.folder_id == folder_id)
    return list(db.scalars(stmt))
