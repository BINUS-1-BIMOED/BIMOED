def calculate_trust(user_history_accuracy, geographical_consistency, report_clustering, temporal_pattern, weights=(0.35,0.25,0.2,0.2)):
    # ensure inputs in [0,1]
    def clamp(x):
        try:
            return max(0.0, min(1.0, float(x)))
        except:
            return 0.0
    u = clamp(user_history_accuracy)
    g = clamp(geographical_consistency)
    r = clamp(report_clustering)
    t = clamp(temporal_pattern)
    w_u, w_g, w_r, w_t = weights
    raw = (w_u * u + w_g * g + w_r * r + w_t * t)
    # optional sigmoid-like scaling to push extremes
    return raw
