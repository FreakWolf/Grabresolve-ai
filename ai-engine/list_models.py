"""
List all available Gemini models for your API key
"""
import google.generativeai as genai
from dotenv import load_dotenv
import os

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

print("📋 Available Models:\n")
for model in genai.list_models():
    if 'generateContent' in model.supported_generation_methods:
        print(f"  ✅ {model.name}")

print("\n👆 Copy one of these model names for config.py")