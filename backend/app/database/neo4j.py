from neo4j import GraphDatabase
from app.config import settings

class Neo4jConnector:
    def __init__(self):
        self.driver = GraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
        )

    def close(self):
        self.driver.close()

    def get_session(self):
        return self.driver.session()

    def execute_write(self, cypher: str, parameters: dict = None):
        with self.get_session() as session:
            return session.run(cypher, parameters)

    def execute_read(self, cypher: str, parameters: dict = None):
        with self.get_session() as session:
            result = session.run(cypher, parameters)
            return [record.data() for record in result]

neo4j_client = Neo4jConnector()
