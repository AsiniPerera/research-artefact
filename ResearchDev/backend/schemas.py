from pydantic import BaseModel, Field, model_validator
from typing import Optional, Literal


class RankingRequest(BaseModel):
    service_family: str
    gender: Literal["male", "female", "unisex"] = "unisex"
    open_now: bool = False
    open_at: Optional[str] = None
    max_distance_km: float = Field(default=5.0, gt=0, le=50)
    user_lat: float
    user_lng: float
    sub_service: Optional[str] = None
    # A whole taxonomy group: match any of its leaves. Soft, like sub_service.
    sub_services: Optional[list[str]] = None
    price_tier: Optional[Literal["budget", "standard", "premium"]] = None
    user_weights: dict[str, int]
    min_results: int = Field(default=3, ge=1)

    @model_validator(mode="after")
    def at_least_one_weight(self):
        if all(v == 0 for v in self.user_weights.values()):
            raise ValueError("At least one category weight must be > 0")
        if any(v < 0 for v in self.user_weights.values()):
            raise ValueError("Weights cannot be negative")
        return self


class RankedSalon(BaseModel):
    rank: int
    salon_id: str
    name: str
    distance_km: float
    F_score: float
    category_scores: dict[str, float]
    reliability: dict[str, float]
    matched_sub_service: bool = False
    price_tier: Optional[str] = None
    service_tags: list[str] = []
    why_ranked: str
    confidence: dict[str, str]
    weak_spot: Optional[str]
    why_not_higher: str


class RankingResponse(BaseModel):
    results: list[RankedSalon]
    no_review_salons: list[dict]
    total_candidates: int
    radius_widened: bool = False
    effective_radius_km: float = 5.0
