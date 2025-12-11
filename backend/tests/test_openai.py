import os
import sys

# Add path to sys to find app (backend root)
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import get_settings  # noqa: E402
from openai import OpenAI  # noqa: E402

settings = get_settings()
api_key = settings.OPENAI_API_KEY

if not api_key:
    print("No API key found")
    sys.exit(1)

client = OpenAI(api_key=api_key)

try:
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": "Hello, are you working?"}],
    )
    print("API Call Successful")
    print(response.choices[0].message.content)
except Exception as e:
    print(f"API Call Failed: {e}")
