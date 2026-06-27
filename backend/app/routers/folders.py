"""Folder CRUD and nested file creation routes."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db

router = APIRouter()


@router.post("", response_model=schemas.FolderRead, status_code=status.HTTP_201_CREATED)
def create_folder(
    folder_in: schemas.FolderCreate,
    db: Session = Depends(get_db),
) -> schemas.FolderRead:
    return crud.create_folder(db, folder_in)


@router.get("", response_model=list[schemas.FolderRead])
def list_folders(db: Session = Depends(get_db)) -> list[schemas.FolderRead]:
    return crud.get_folders(db)


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_folder(folder_id: int, db: Session = Depends(get_db)) -> None:
    crud.delete_folder(db, folder_id)


@router.post(
    "/{folder_id}/files",
    response_model=schemas.FileRead,
    status_code=status.HTTP_201_CREATED,
)
def create_file_in_folder(
    folder_id: int,
    file_in: schemas.FileCreateInFolder,
    db: Session = Depends(get_db),
) -> schemas.FileRead:
    return crud.create_file(
        db,
        schemas.FileCreate(name=file_in.name, folder_id=folder_id),
    )
