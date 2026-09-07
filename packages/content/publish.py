"""Upload an immutable content release directly to private storage, never GitHub."""

import argparse
import hashlib
import json
import os
from pathlib import Path
from dotenv import load_dotenv
from packages.content.storage import content_client, decode_bundle


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--bundle", default="content/generated/bundle.json")
    p.add_argument("--env-file", default=".env.local")
    args = p.parse_args()
    load_dotenv(args.env_file, override=False)
    data = Path(args.bundle).read_bytes()
    sha = hashlib.sha256(data).hexdigest()
    bundle = decode_bundle(data, sha)
    key = f"bundles/{bundle.content_version}-{sha[:12]}.json"
    client = content_client()
    # A content-addressed key is immutable by construction; retries upload identical bytes.
    client.put_object(
        Bucket=os.environ["MACHINA_CONTENT_BUCKET"],
        Key=key,
        Body=data,
        ContentType="application/json",
        CacheControl="private, no-store",
    )
    print(
        json.dumps(
            {
                "content_key": key,
                "sha256": sha,
                "content_version": bundle.content_version,
            }
        )
    )


if __name__ == "__main__":
    main()
