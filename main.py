import os
import google.generativeai as genai
from google.generativeai import types
from flask import Flask, request, jsonify, send_from_directory
from dotenv import load_dotenv

load_dotenv() # Load environment variables from .env file

app = Flask(__name__, static_folder='.', static_url_path='')

# Configure Gemini API
api_key = os.getenv("API_KEY")
if not api_key:
    raise ValueError("GEMINI_API_KEY not found in environment variables. Please set it in the .env file.")

genai.configure(api_key=api_key)

# --- Gemini Generation Logic ---

# System instruction to guide the AI
SYSTEM_INSTRUCTION = """You are an assistant that converts natural language descriptions of Resource Allocation Graphs (RAG) into a specific script format for a simulator.
The user will describe processes (circles, often denoted P1, P2, etc.), resources (squares, often denoted R1, R2, etc.), requests (Process -> Resource edge), and assignments (Resource -> Process edge). Resources can have multiple instances.

Output ONLY the script commands, one per line or separated by semicolons. Do not include any other text, explanations, code blocks (like ```), or markdown formatting.

Available commands:
- ADD P <process_id> : Adds a process. Example: ADD P P1
- ADD R <resource_id> [instances] : Adds a resource. Instances default to 1 if omitted. Example: ADD R R1 or ADD R R2 3
- REQ <process_id> <resource_id> : Adds a request edge from process to resource. Example: REQ P1 R1
- ASSIGN <process_id> <resource_id> : Adds an assignment edge from resource to process. This command implies the resource is assigned TO the process. Example: ASN P2 R1 (meaning R1 -> P2)

Example User Input: "Create a process P1 requesting resource R1, which has 2 instances. Also add process P2 assigned resource R1."
Example Output:
ADD P P1
ADD R R1 2
REQ P1 R1
ADD P P2
ASSIGN P2 R1

Example User Input: "Process P5 needs resource R10. R10 is assigned to P6."
Example Output:
ADD P P5
ADD R R10
REQ P5 R10
ADD P P6
ASSIGN P6 R10

Strictly adhere to the output format. Only commands.
"""

def generate_graph_script(user_input: str) -> str:
    """Generates RAG script commands from natural language using Gemini."""
    try:
        # Using a standard model, adjust if needed (e.g., 'gemini-1.5-flash')
        # Vertex AI client initialization would look different if needed:
        # client = genai.Client(vertexai=True, project=os.getenv("VERTEX_PROJECT"), location=os.getenv("VERTEX_LOCATION"))
        # model = client.get_model("gemini-1.5-flash-001") # Or other Vertex model

        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash-lite", # Using a standard Gemini model
            system_instruction=SYSTEM_INSTRUCTION,
            generation_config=types.GenerationConfig(
                response_mime_type="text/plain"
            )
        )

        response = model.generate_content(user_input)

        # Clean up the response text slightly (remove potential leading/trailing whitespace)
        script = response.text.strip()
        return script

    except Exception as e:
        print(f"Error calling Gemini API: {e}")
        # Consider more specific error handling based on google.api_core.exceptions
        return f"ERROR: Failed to generate script - {e}"

# --- Flask Routes ---

@app.route('/')
def index():
    """Serves the main HTML file."""
    # Use send_from_directory for security
    return send_from_directory('.', 'index.html')

@app.route('/generate-graph-from-text', methods=['POST'])
def handle_generate_graph():
    """API endpoint to generate graph script from text."""
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    data = request.get_json()
    user_text = data.get('text')

    if not user_text:
        return jsonify({"error": "Missing 'text' field in request body"}), 400

    print(f"Received text for generation: {user_text}") # Log received text
    generated_script = generate_graph_script(user_text)
    print(f"Generated script: {generated_script}") # Log generated script

    if generated_script.startswith("ERROR:"):
         return jsonify({"error": generated_script}), 500
    else:
        return jsonify({"script": generated_script}), 200

if __name__ == '__main__':
    # Use host='0.0.0.0' to make it accessible on your network
    # Debug=True is helpful during development but should be False in production
    app.run(debug=True, host='0.0.0.0', port=5000)
