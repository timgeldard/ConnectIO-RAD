"""
Domain logic for mass balance calculations.
"""

def calculate_mass_balance_variance(
    produced: float, 
    shipped: float, 
    actual_stock: float
) -> float:
    """
    Calculate the variance between actual stock and theoretical (produced - shipped).
    """
    return actual_stock - (produced - shipped)


def movement_delta(category: str, balance_qty: float) -> float:
    """
    Normalize movement delta based on category.
    Production receipts are positive, Shipments are negative.
    """
    if category == "Production":
        return abs(balance_qty)
    if category == "Shipment":
        return -abs(balance_qty)
    return balance_qty
