from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.api.deps import get_llm_service
from backend.application.service.llm_service import LLMService


router = APIRouter(prefix="/llm", tags=["llm"])


class ChatRequest(BaseModel):
    prompt: str = Field(min_length=1)
    system: str | None = None


class ChatResponse(BaseModel):
    response: str


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, service: LLMService | None = Depends(get_llm_service)) -> ChatResponse:
    if not service:
        raise HTTPException(status_code=503, detail="LLM not configured (missing GEMINI_API_KEY)")
    text = await service.chat(prompt=req.prompt, system=req.system or "You are a helpful assistant.")
    return ChatResponse(response=text)
