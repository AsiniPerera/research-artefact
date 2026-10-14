from pydantic import BaseModel, Field, model_validator
from typing import Optional, Literal


# 7-category framework v4
CATEGORIES = {
    1: "Quality of Work",
    2: "Safety & Hygiene",
    3: "Customer Handling",
    4: "Transparency & Ethics",
    5: "Staff & Service Delivery",
    6: "Environment & Facilities",
    7: "Value & Accessibility",
}

CATEGORY_KEYS = [
    "quality_of_work",
    "safety_hygiene",
    "customer_handling",
    "transparency_ethics",
    "staff_service_delivery",
    "environment_facilities",
    "value_accessibility",
]

# Map category_no to key for API usage
CATEGORY_NO_TO_KEY = {
    1: "quality_of_work",
    2: "safety_hygiene",
    3: "customer_handling",
    4: "transparency_ethics",
    5: "staff_service_delivery",
    6: "environment_facilities",
    7: "value_accessibility",
}


class RankingRequest(BaseModel):
    service_family: str
    gender: Literal["male", "female", "unisex"] = "unisex"
    open_now: bool = False
    open_at: Optional[str] = None
    max_distance_km: float = Field(default=5.0, gt=0, le=50)
    user_lat: float
    user_lng: float
    sub_service: Optional[str] = None
    sub_services: Optional[list[str]] = None
    price_tier: Optional[Literal["budget", "standard", "premium"]] = None
    user_weights: dict[str, int]  # keys: category keys like "quality_of_work"
    min_results: int = Field(default=3, ge=1)

    @model_validator(mode="after")
    def at_least_one_weight(self):
        if all(v == 0 for v in self.user_weights.values()):
            raise ValueError("At least one category weight must be > 0")
        if any(v < 0 for v in self.user_weights.values()):
            raise ValueError("Weights cannot be negative")
        return self


class SubPointScore(BaseModel):
    code: str
    score: float
    n_opinions: int = 0
    positive_count: int = 0
    negative_count: int = 0


class RankedSalon(BaseModel):
    rank: int
    salon_id: str
    name: str
    distance_km: float
    F_score: float
    category_scores: dict[str, float]       # 7 category scores
    sub_point_scores: dict[str, float] = {}  # 25 sub-point scores
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
