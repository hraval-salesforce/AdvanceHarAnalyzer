"""
Claude API service for HAR file analysis.
This service retrieves API keys from the database and proxies requests to Claude API,
ensuring keys are never exposed to the frontend.
"""
import httpx
from typing import Optional
from datetime import datetime
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from backend.database import APIKey
from anthropic import Anthropic, APIError, APIConnectionError, RateLimitError


class ClaudeService:
    """Service for interacting with Claude API"""

    def __init__(self, db: Session):
        self.db = db
        self._client: Optional[Anthropic] = None

    def _get_active_api_key(self) -> str:
        """
        Retrieve an active Claude API key from the database.
        Returns the most recently used active key.
        """
        key_record = (
            self.db.query(APIKey)
            .filter(APIKey.is_active == True)
            .order_by(APIKey.last_used.desc().nullsfirst())
            .first()
        )

        if not key_record:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="No active Claude API key configured. Please add an API key in the admin panel."
            )

        # Update last_used timestamp
        key_record.last_used = datetime.utcnow()
        self.db.commit()

        return key_record.api_key

    def _get_client(self) -> Anthropic:
        """Get or create Anthropic client with active API key"""
        if not self._client:
            api_key = self._get_active_api_key()
            self._client = Anthropic(api_key=api_key)
        return self._client

    async def analyze_har_data(self, har_data: dict, analysis_prompt: str) -> dict:
        """
        Analyze HAR file data using Claude API.
        If har_data contains a 'system_prompt' key, it is used as the system prompt
        (this is how the frontend passes custom system prompts for different analysis types).
        """
        try:
            client = self._get_client()

            # If the frontend passed a custom system prompt inside har_data, use it
            if "system_prompt" in har_data:
                system_prompt = har_data["system_prompt"]
                user_message = analysis_prompt
            else:
                system_prompt = """You are an expert web performance analyst specializing in HAR (HTTP Archive) file analysis.
You help developers understand network performance, identify bottlenecks, and optimize web applications.

Provide clear, actionable insights based on the HAR data provided. Focus on:
- Performance bottlenecks (slow requests, large payloads)
- Third-party service impacts
- Potential optimizations
- Security considerations (mixed content, insecure requests)
- Best practices violations

Format your response in a clear, structured manner with specific recommendations."""

                user_message = f"""Please analyze the following HAR file data:

{har_data}

User's Question/Request:
{analysis_prompt}

Provide a detailed analysis addressing the user's specific question while also highlighting any critical performance or security issues you notice."""

            # Call Claude API
            response = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=4096,
                temperature=0.7,
                system=system_prompt,
                messages=[
                    {
                        "role": "user",
                        "content": user_message
                    }
                ]
            )

            # Extract text from response
            analysis_text = ""
            for content_block in response.content:
                if hasattr(content_block, 'text'):
                    analysis_text += content_block.text

            return {
                "analysis": analysis_text,
                "model": response.model,
                "usage": {
                    "input_tokens": response.usage.input_tokens,
                    "output_tokens": response.usage.output_tokens
                }
            }

        except RateLimitError as e:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Claude API rate limit exceeded. Please try again later."
            )
        except APIConnectionError as e:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Unable to connect to Claude API. Please check your network connection."
            )
        except APIError as e:
            # Check if it's an authentication error
            if e.status_code == 401:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid Claude API key. Please update the API key in admin panel."
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Claude API error: {str(e)}"
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Analysis failed: {str(e)}"
            )

    async def test_api_key(self, api_key: str) -> dict:
        """
        Test if a Claude API key is valid by making a minimal API call.

        Args:
            api_key: Claude API key to test

        Returns:
            dict: Validation result with status and details
        """
        try:
            client = Anthropic(api_key=api_key)

            # Make a minimal test call
            response = client.messages.create(
                model="claude-3-5-haiku-20241022",  # Use cheaper model for testing
                max_tokens=10,
                messages=[
                    {
                        "role": "user",
                        "content": "Hello"
                    }
                ]
            )

            return {
                "valid": True,
                "message": "API key is valid",
                "model": response.model
            }

        except APIError as e:
            if e.status_code == 401:
                return {
                    "valid": False,
                    "message": "Invalid API key - authentication failed"
                }
            return {
                "valid": False,
                "message": f"API key validation failed: {str(e)}"
            }
        except Exception as e:
            return {
                "valid": False,
                "message": f"Validation error: {str(e)}"
            }
