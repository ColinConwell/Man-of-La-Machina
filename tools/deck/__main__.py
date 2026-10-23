import argparse
from library.ports import serve
from dotenv import load_dotenv
from .app import create_deck, ROOT

if __name__ == '__main__':
    load_dotenv(ROOT / '.env.local', override=False)
    parser = argparse.ArgumentParser(description='Serve the private, local-only project deck on loopback.')
    parser.add_argument('--port', type=int, default=None, help='exact port (default: 8003 or the next free port)')
    parser.add_argument('--content', default=None, help='Private deck JSON (default manuscript/deck/deck.local.json)')
    args = parser.parse_args()
    serve(create_deck(args.content), 'deck', port=args.port, access_log=False)
