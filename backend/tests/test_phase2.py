from backend.app.heuristics import check_typosquatting, check_homoglyphs, run_heuristics

def test_levenshtein_distance():
    from backend.app.heuristics import levenshtein_distance
    assert levenshtein_distance("google", "google") == 0
    assert levenshtein_distance("google", "gogle") == 1
    assert levenshtein_distance("google", "googel") == 2
    assert levenshtein_distance("facebook", "faceboook") == 1

def test_check_typosquatting():
    assert check_typosquatting("google.com") is False
    assert check_typosquatting("gogle.com") is True
    assert check_typosquatting("facebok.com") is True
    assert check_typosquatting("facebook.com") is False
    assert check_typosquatting("randomsite.com") is False

def test_check_homoglyphs():
    assert check_homoglyphs("example.com") is False
    assert check_homoglyphs("xn--bcher-kva.ch") is True
    assert check_homoglyphs("gоogle.com") is True  # contains cyrillic 'o'
    assert check_homoglyphs("apple.com") is False

def test_run_heuristics():
    result = run_heuristics("gogle.com")
    assert result["is_typosquat"] is True
    assert result["has_homoglyphs"] is False

if __name__ == "__main__":
    test_levenshtein_distance()
    test_check_typosquatting()
    test_check_homoglyphs()
    test_run_heuristics()
    print("All Phase 2 Heuristics tests passed!")
