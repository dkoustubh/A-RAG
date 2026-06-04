from fastapi import APIRouter, Depends, HTTPException
from app.database.neo4j import neo4j_client
from app.security import verify_employee
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

router = APIRouter(prefix="/graph", tags=["graph"])

class CypherRequest(BaseModel):
    query: str

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
        rfq_count = node.get("rfq_count") or 0
        nodes.append({
            "id": str(node["id"]),
            "label": node["label"] or "Entity",
            "name": node["name"] or f"Node-{node['id']}",
            "val": 10 + (rfq_count * 5)
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

@router.post("/query")
def run_cypher_query(req: CypherRequest, current_user = Depends(verify_employee)):
    """
    Executes a custom Cypher query and parses nodes and links dynamically from the response.
    """
    # Restrict destructive commands for security unless admin, but allow general reads
    q_lower = req.query.lower()
    destructive = ["delete", "detach delete", "drop database", "remove"]
    if any(k in q_lower for k in destructive) and current_user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Write operations or node deletion are restricted to Administrator role."
        )

    nodes_dict = {}
    links = []

    def get_id(obj):
        return str(getattr(obj, "element_id", getattr(obj, "id", str(id(obj)))))

    try:
        with neo4j_client.get_session() as session:
            result = session.run(req.query)
            for record in result:
                for key, value in record.items():
                    # 1. Check if the value itself is a Node
                    # Duck typing check for neo4j.graph.Node
                    if hasattr(value, "labels") and hasattr(value, "items"):
                        n_id = get_id(value)
                        labels = list(value.labels)
                        label = labels[0] if labels else "Entity"
                        props = dict(value.items())
                        name = props.get("name") or props.get("location") or f"{label}-{n_id[:6]}"
                        nodes_dict[n_id] = {
                            "id": n_id,
                            "label": label,
                            "name": name,
                            "val": 10 + (props.get("rfq_count", 0) * 5)
                        }

                    # 2. Check if the value is a Relationship
                    elif hasattr(value, "start_node") and hasattr(value, "end_node"):
                        rel_id = get_id(value)
                        src_node = value.start_node
                        tgt_node = value.end_node
                        
                        src_id = get_id(src_node)
                        tgt_id = get_id(tgt_node)
                        
                        # Extract source node if not already seen
                        if src_id not in nodes_dict:
                            src_labels = list(src_node.labels)
                            src_label = src_labels[0] if src_labels else "Entity"
                            src_props = dict(src_node.items())
                            src_name = src_props.get("name") or src_props.get("location") or f"{src_label}-{src_id[:6]}"
                            nodes_dict[src_id] = {
                                "id": src_id,
                                "label": src_label,
                                "name": src_name,
                                "val": 10
                            }
                            
                        # Extract target node if not already seen
                        if tgt_id not in nodes_dict:
                            tgt_labels = list(tgt_node.labels)
                            tgt_label = tgt_labels[0] if tgt_node.labels else "Entity"
                            tgt_props = dict(tgt_node.items())
                            tgt_name = tgt_props.get("name") or tgt_props.get("location") or f"{tgt_label}-{tgt_id[:6]}"
                            nodes_dict[tgt_id] = {
                                "id": tgt_id,
                                "label": tgt_label,
                                "name": tgt_name,
                                "val": 10
                            }

                        confidence_val = dict(value.items()).get("confidence") or 0.85
                        links.append({
                            "source": src_id,
                            "target": tgt_id,
                            "label": value.type,
                            "confidence": f"{int(confidence_val * 100)}%"
                        })
                        
        return {"nodes": list(nodes_dict.values()), "links": links}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cypher Syntax Error: {str(e)}")
