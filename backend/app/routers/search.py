"""File search routes."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db

router = APIRouter()


@router.get("", response_model=list[schemas.FileRead])
def search_files(
    query: str = Query(min_length=1, description="Prefix to match against file names (starts-with)"),
    folder_id: int | None = Query(
        default=None,
        description="Limit search to files directly in this folder (not subfolders)",
    ),
    db: Session = Depends(get_db),
) -> list[schemas.FileRead]:
    return crud.search_files(db, query=query, folder_id=folder_id)
