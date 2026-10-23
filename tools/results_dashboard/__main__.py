import argparse
from library.ports import serve
from dotenv import load_dotenv
from .app import create_dashboard, DEFAULT_RESULTS

if __name__ == '__main__':
    load_dotenv(DEFAULT_RESULTS.parents[1] / '.env.local', override=False)
    parser = argparse.ArgumentParser(description='Serve the independent, read-only results dashboard on loopback.')
    parser.add_argument('--port', type=int, default=None, help='exact port (default: 8002 or the next free port)')
    parser.add_argument('--results', default=str(DEFAULT_RESULTS))
    args = parser.parse_args()
    serve(create_dashboard(args.results), 'results', port=args.port, access_log=False)
