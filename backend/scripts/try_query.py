"""Print the top retrieval hits for one or more queries (debugging aid).

Usage:  python scripts/try_query.py "my boss has not paid my salary"
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from rag.retriever import get_retriever  # noqa: E402

if __name__ == "__main__":
    r = get_retriever()
    for q in sys.argv[1:]:
        print(f"\n=== {q}")
        for chunk, score in r.search(q, top_k=6):
            print(f"  {score:.3f}  {chunk['id']}")
