from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="LNOVEL_")

    data_dir: Path = Path(__file__).resolve().parent.parent.parent / "data"
    db_filename: str = "lnovel.db"
    static_dir: Path | None = None  # set when serving built frontend in Docker
    llm_mock: bool = False

    @property
    def db_path(self) -> Path:
        return self.data_dir / self.db_filename


settings = Settings()
settings.data_dir.mkdir(parents=True, exist_ok=True)
