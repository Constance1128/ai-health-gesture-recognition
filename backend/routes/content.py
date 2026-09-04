from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any, List
import database as db

router = APIRouter()

@router.get("/content/faqs")
def get_faqs():
    return db.get_faqs()

@router.post("/content/faqs")
def create_faq(payload: Dict[str, Any] = Body(...)):
    question = payload.get("question")
    answer = payload.get("answer")
    category = payload.get("category", "General")
    if not question or not answer:
        raise HTTPException(status_code=400, detail="Question and answer required")
    success = db.create_faq(question, answer, category)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to create FAQ")
    return {"message": "FAQ created successfully"}

@router.delete("/content/faqs/{faq_id}")
def delete_faq(faq_id: int):
    success = db.delete_faq(faq_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete FAQ")
    return {"message": "FAQ deleted successfully"}

@router.get("/content/articles")
def get_articles():
    return db.get_articles()

@router.post("/content/articles")
def create_article(payload: Dict[str, Any] = Body(...)):
    title = payload.get("title")
    content = payload.get("content")
    author_id = payload.get("author_id")
    if not title or not content or not author_id:
        raise HTTPException(status_code=400, detail="Title, content, and author required")
    success = db.create_article(title, content, author_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to create article")
    return {"message": "Article created successfully"}

@router.delete("/content/articles/{article_id}")
def delete_article(article_id: int):
    success = db.delete_article(article_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete article")
    return {"message": "Article deleted successfully"}
