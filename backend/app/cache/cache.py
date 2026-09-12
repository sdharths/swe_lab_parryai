import aiosqlite
import json
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from backend.app.constants import CACHE_MAX_ENTRIES, CACHE_TTL_HOURS, CACHE_SHORT_TTL_HOURS
from backend.app.schemas import AnalyzeResponse, RiskMatrix

class VerdictCache:
    def __init__(self, db_path: str = "verdict_cache.db"):
        self.db_path = db_path

    async def init_db(self):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                CREATE TABLE IF NOT EXISTS verdicts (
                    domain TEXT PRIMARY KEY,
                    verdict TEXT,
                    risk_score REAL,
                    risk_matrix TEXT,
                    why_explainer TEXT,
                    timestamp TEXT
                )
            """)
            # Create index on timestamp for fast eviction
            await db.execute("CREATE INDEX IF NOT EXISTS idx_timestamp ON verdicts (timestamp)")
            await db.commit()

    async def get(self, domain: str) -> Optional[AnalyzeResponse]:
        """
        Get a cached verdict if it exists and hasn't expired.
        """
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute("SELECT verdict, risk_score, risk_matrix, why_explainer, timestamp FROM verdicts WHERE domain = ?", (domain,)) as cursor:
                row = await cursor.fetchone()
                
                if not row:
                    return None
                    
                verdict, risk_score, risk_matrix_str, why_explainer, timestamp_str = row
                
                # Check TTL
                analyzed_at = datetime.fromisoformat(timestamp_str)
                now = datetime.now(timezone.utc)
                
                ttl_hours = CACHE_TTL_HOURS if verdict not in ["uncertain", "local_fallback"] else CACHE_SHORT_TTL_HOURS
                
                if now - analyzed_at > timedelta(hours=ttl_hours):
                    # Expired
                    return None
                    
                return AnalyzeResponse(
                    url="",  # We'll fill this in main.py
                    domain=domain,
                    verdict=verdict,
                    risk_score=risk_score,
                    risk_matrix=RiskMatrix(**json.loads(risk_matrix_str)),
                    why_explainer=why_explainer,
                    cached=True,
                    analyzed_at=timestamp_str
                )

    async def put(self, domain: str, response: AnalyzeResponse):
        """
        Store a new verdict in the cache.
        """
        timestamp = datetime.now(timezone.utc).isoformat()
        risk_matrix_str = response.risk_matrix.model_dump_json()
        
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                INSERT OR REPLACE INTO verdicts 
                (domain, verdict, risk_score, risk_matrix, why_explainer, timestamp) 
                VALUES (?, ?, ?, ?, ?, ?)
            """, (domain, response.verdict, response.risk_score, risk_matrix_str, response.why_explainer, timestamp))
            await db.commit()
            
        # Evict old entries if we exceed cap (background/async)
        await self.evict_oldest()

    async def evict_oldest(self):
        """
        If we have more than CACHE_MAX_ENTRIES, delete the oldest ones.
        """
        async with aiosqlite.connect(self.db_path) as db:
            # Count rows
            async with db.execute("SELECT COUNT(*) FROM verdicts") as cursor:
                count = (await cursor.fetchone())[0]
                
            if count > CACHE_MAX_ENTRIES:
                limit = count - CACHE_MAX_ENTRIES
                await db.execute("""
                    DELETE FROM verdicts 
                    WHERE domain IN (
                        SELECT domain FROM verdicts 
                        ORDER BY timestamp ASC 
                        LIMIT ?
                    )
                """, (limit,))
                await db.commit()
                
    async def shadow_refresh_all(self):
        """
        Manual trigger to re-validate all cached entries.
        (Implementation will be wired to call the full pipeline in main.py)
        """
        pass
