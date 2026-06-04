from fastapi import APIRouter, Depends
from app.database.neo4j import neo4j_client
from app.security import verify_employee

router = APIRouter(prefix="/graph", tags=["graph"])

@router.get("/data")
def get_graph_data(current_user = Depends(verify_employee)):
    """
    Returns full node and edge datasets for frontend D3/Mermaid visualizers.
    """
    cypher_nodes = "MATCH (n) RETURN id(n) AS id, labels(n)[0] AS label, n.name AS name, n.rfq_count AS rfq_count"
    cypher_edges = "MATCH (n)-[r]->(m) RETURN id(n) AS source, id(m) AS target, type(r) AS relation, r.confidence AS confidence"
    
    nodes_res = neo4j_client.execute_read(cypher_nodes)
    edges_res = neo4j_client.execute_read(cypher_edges)
    
    nodes = []
    for node in nodes_res:
        nodes.append({
            "id": str(node["id"]),
            "label": node["label"] or "Entity",
            "name": node["name"] or f"Node-{node['id']}",
            "val": 10 + (node.get("rfq_count", 0) * 5)
        })
        
    links = []
    for edge in edges_res:
        links.append({
            "source": str(edge["source"]),
            "target": str(edge["target"]),
            "label": edge["relation"],
            "confidence": f"{int((edge.get('confidence') or 0.85) * 100)}%"
        })
        
    return {"nodes": nodes, "links": links}
