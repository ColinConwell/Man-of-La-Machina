import argparse
import uvicorn
from dotenv import load_dotenv
from .app import create_dashboard, DEFAULT_RESULTS

if __name__ == '__main__':
    load_dotenv(DEFAULT_RESULTS.parents[1] / '.env.local', override=False)
    parser = argparse.ArgumentParser(description='Serve the independent, read-only results dashboard on loopback.')
    parser.add_argument('--port', type=int, default=8002)
    parser.add_argument('--results', default=str(DEFAULT_RESULTS))
    args = parser.parse_args()
    uvicorn.run(create_dashboard(args.results), host='127.0.0.1', port=args.port, access_log=False)
