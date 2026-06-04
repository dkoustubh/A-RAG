from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import make_asgi_app
from app.config import settings
from app.database.postgres import engine, Base, SessionLocal
from app.database.models import User
from app.security import get_password_hash
from app.routers import auth, upload, search, documents, graph, pipeline, monitoring

# Initialize Database tables
try:
    Base.metadata.create_all(bind=engine)
    # Seed default admin user
    db = SessionLocal()
    admin = db.query(User).filter(User.username == "admin").first()
    if not admin:
        hashed_pwd = get_password_hash("Ats@123*")
        db.add(User(username="admin", hashed_password=hashed_pwd, role="admin"))
        db.commit()
    db.close()
except Exception as e:
    print(f"Error creating database tables: {e}")

app = FastAPI(
    title="A-RAG API",
    description="Autonomous Retrieval Augmented Graph Intelligence Platform Backend",
    version="1.0.0"
)

# CORS configurations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(search.router)
app.include_router(documents.router)
app.include_router(graph.router)
app.include_router(pipeline.router)
app.include_router(monitoring.router)

# Expose Prometheus Metrics Endpoint
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "A-RAG Platform Engine",
        "docs": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
