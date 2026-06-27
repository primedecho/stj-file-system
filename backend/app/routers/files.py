"""File listing and deletion routes."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db

router = APIRouter()


@router.get("", response_model=list[schemas.FileRead])
def list_files(
    folder_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[schemas.FileRead]:
    if folder_id is not None:
        crud.get_folder_or_raise(db, folder_id)
    return crud.get_files(db, folder_id=folder_id)


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file(file_id: int, db: Session = Depends(get_db)) -> None:
    crud.delete_file(db, file_id)
