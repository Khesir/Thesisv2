"""
MongoDB Connection
Handles connection to MongoDB for crop data retrieval
"""
import os
from typing import Optional
from pymongo import MongoClient
import logging

logger = logging.getLogger(__name__)


class DatabaseConnection:
    """Database connection manager"""
    _instance: Optional['DatabaseConnection'] = None
    _client: Optional[MongoClient] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def connect(self) -> MongoClient:
        """Get or create database connection"""
        if self._client is None:
            mongo_uri = os.getenv(
                'MONGODB_URI',
                'mongodb://localhost:27017'
            )
            db_name = os.getenv('MONGODB_NAME', 'thesis')

            try:
                self._client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
                # Verify connection
                self._client.admin.command('ping')
                self.db = self._client[db_name]
                logger.info(f"Connected to MongoDB: {db_name}")
            except Exception as e:
                logger.error(f"Failed to connect to MongoDB: {e}")
                self._client = None
                raise

        return self._client

    def get_database(self):
        """Get the database instance"""
        if self._client is None:
            self.connect()
        return self.db

    def close(self):
        """Close the database connection"""
        if self._client:
            self._client.close()
            self._client = None
            logger.info("Database connection closed")


def get_db():
    """Get database instance (singleton)"""
    conn = DatabaseConnection()
    return conn.get_database()


def close_db():
    """Close database connection"""
    conn = DatabaseConnection()
    conn.close()
