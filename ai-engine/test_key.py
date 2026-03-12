"""
Test Gemini API connection — FIXED
"""
import google.generativeai as genai
from dotenv import load_dotenv
import os
import warnings
warnings.filterwarnings("ignore")

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
print(f"API Key: {'✅ Loaded (' + api_key[:10] + '...)' if api_key else '❌ MISSING'}")

genai.configure(api_key=api_key)

# List available models
print("\n📋 Available Models:")
available_models = []
for model in genai.list_models():
    if 'generateContent' in model.supported_generation_methods:
        available_models.append(model.name)
        print(f"   ✅ {model.name}")

if not available_models:
    print("   ❌ No models found! Check your API key.")
    exit(1)

# Try models in priority order
models_to_try = [
    "gemini-2.5-flash",
    "gemini-pro-latest",
    # "gemini-2.0-flash-lite", 
    # "gemini-1.5-flash-latest",
    # "gemini-1.5-flash",
    # "gemini-1.5-pro",
    # "gemini-pro",
]

working_model = None

print("\n🔄 Testing models...\n")

for model_name in models_to_try:
    full_name = f"models/{model_name}"
    if full_name in available_models:
        try:
            print(f"   Testing {model_name}...", end=" ")
            model = genai.GenerativeModel(model_name)
            response = model.generate_content("Say 'Hello GrabResolve!' in one line only")
            text = response.text.strip()
            print(f"✅ Works! Response: {text}")
            working_model = model_name
            break
        except Exception as e:
            print(f"❌ Failed: {e}")
    else:
        print(f"   Skipping {model_name} — not available")

if working_model:
    print(f"\n{'='*50}")
    print(f"🎉 USE THIS MODEL: {working_model}")
    print(f"{'='*50}")
    print(f"\n📌 Update ai-engine/config.py:")
    print(f'   LLM_MODEL = "{working_model}"')
    print(f"{'='*50}")
else:
    print("\n❌ No working model found!")
    print("Try these fixes:")
    print("1. Check your internet connection")
    print("2. Create a new API key at https://aistudio.google.com/app/apikey")
    print("3. Try a different Google account")