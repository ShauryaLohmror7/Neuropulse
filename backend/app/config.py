"""Runtime configuration for the NEUROPULSE backend.

All biological data in this project comes from the MaleCNS v1.0 adult male
*Drosophila melanogaster* central nervous system reconstruction, served by the
Janelia neuPrint instance.  Nothing here fabricates neurons: if the connection
cannot be established the application fails loudly rather than substituting
synthetic data.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Environment-driven settings.

    Read from (in priority order) process environment, ``backend/.env``,
    then repo-root ``.env``.
    """

    model_config = SettingsConfigDict(
        env_file=(REPO_ROOT / ".env", REPO_ROOT / "backend" / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    neuprint_token: str = Field(default="", description="neuPrint auth token (JWT).")
    neuprint_server: str = Field(default="https://neuprint.janelia.org")
    neuprint_dataset: str = Field(default="male-cns:v1.0")

    neuropulse_data_dir: str = Field(default="data")
    neuropulse_host: str = Field(default="127.0.0.1")
    neuropulse_port: int = Field(default=8000)

    gemini_api_key: SecretStr = SecretStr("")
    neuropulse_llm_model: str = "gemini-3.5-flash-lite"

    # --- derived paths -------------------------------------------------
    @property
    def data_dir(self) -> Path:
        p = Path(self.neuropulse_data_dir)
        return p if p.is_absolute() else (REPO_ROOT / p)

    @property
    def cache_dir(self) -> Path:
        return self.data_dir / "cache"

    @property
    def circuits_dir(self) -> Path:
        return self.data_dir / "circuits"

    @property
    def metadata_dir(self) -> Path:
        return self.data_dir / "metadata"

    def ensure_dirs(self) -> None:
        for d in (self.cache_dir, self.circuits_dir, self.metadata_dir):
            d.mkdir(parents=True, exist_ok=True)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
