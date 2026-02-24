import argparse
import uvicorn
from .app import create_app


def main():
    parser = argparse.ArgumentParser(description="UCP Brand Server")
    parser.add_argument("--port",                  type=int, default=8182)
    parser.add_argument("--host",                  type=str, default="127.0.0.1")
    parser.add_argument("--products_db_path",      type=str, default="C:/tmp/ucp_test/products.db")
    parser.add_argument("--transactions_db_path",  type=str, default="C:/tmp/ucp_test/transactions.db")
    parser.add_argument("--simulation_secret",     type=str, default="dev-secret")
    args = parser.parse_args()

    app = create_app(
        products_db_path=args.products_db_path,
        transactions_db_path=args.transactions_db_path,
        simulation_secret=args.simulation_secret,
    )

    print(f"  UCP Brand Server starting on http://{args.host}:{args.port}")
    print(f"  Transactions DB : {args.transactions_db_path}")
    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
