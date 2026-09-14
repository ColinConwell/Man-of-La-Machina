from .app import create_curator
import uvicorn

if __name__ == "__main__":
    uvicorn.run(create_curator(), host="127.0.0.1", port=8001, access_log=False)
