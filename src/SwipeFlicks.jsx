import React, { useEffect, useMemo, useRef, useState, useImperativeHandle, forwardRef } from "react";

const SwipeCard = forwardRef(function SwipeCard({ id, onSwipe, onCardLeftScreen, disabled = false, style = {}, className = "", threshold = 120, children }, ref) {
  const elRef = useRef(null);
  const startRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [rot, setRot] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  useImperativeHandle(ref, () => ({
    swipe(direction = "right") {
      if (isExiting) return;
      const sign = direction === "right" ? 1 : -1;
      setIsExiting(true);
      setOffset({ x: sign * (window.innerWidth || 1000), y: -100 });
      setRot(sign * 30);
      setTimeout(() => {
        onSwipe && onSwipe(direction);
        onCardLeftScreen && onCardLeftScreen();
      }, 300);
    }
  }), [isExiting, onSwipe, onCardLeftScreen]);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    function onPointerDown(e) {
      if (disabled || isExiting) return;
      try {
        el.setPointerCapture(e.pointerId);
      } catch (_) {}
      draggingRef.current = true;
      startRef.current = { x: e.clientX, y: e.clientY };
      el.style.transition = "none";
    }

    function onPointerMove(e) {
      if (!draggingRef.current) return;
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      setOffset({ x: dx, y: dy });
      setRot(Math.max(Math.min(dx / 20, 40), -40));
    }

    function onPointerUp(e) {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch (_) {}
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      if (dx > threshold) {
        setIsExiting(true);
        setOffset({ x: (window.innerWidth || 1000), y: dy });
        setRot(30);
        el.style.transition = "transform 300ms ease-out";
        setTimeout(() => {
          onSwipe && onSwipe("right");
          onCardLeftScreen && onCardLeftScreen();
        }, 300);
      } else if (dx < -threshold) {
        setIsExiting(true);
        setOffset({ x: -(window.innerWidth || 1000), y: dy });
        setRot(-30);
        el.style.transition = "transform 200ms ease-out";
        setTimeout(() => {
          onSwipe && onSwipe("left");
          onCardLeftScreen && onCardLeftScreen();
        }, 300);
      } else {
        el.style.transition = "transform 200ms ease-out";
        setOffset({ x: 0, y: 0 });
        setRot(0);
      }
    }

    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [disabled, isExiting, onSwipe, onCardLeftScreen, threshold]);

  const transform = `translate(${offset.x}px, ${offset.y}px) rotate(${rot}deg)`;
  const baseStyle = {
    transform,
    touchAction: "none",
    cursor: disabled ? "default" : "grab",
    willChange: "transform",
    ...style
  };

  return (
    <div
      ref={elRef}
      style={baseStyle}
      className={className}
      aria-hidden={isExiting}
    >
      <div style={{ position: "absolute", top: 8, left: 8, pointerEvents: "none", fontSize: 12, opacity: Math.min(Math.abs(offset.x) / 200, 1) }}>
        {offset.x > 0 ? "LIKE →" : offset.x < 0 ? "← NOPE" : ""}
      </div>
      {typeof children === "function" ? children({ offset, rot }) : children}
    </div>
  );
});

export default function SwipeFlicks() {
  const STORAGE_KEY = "swipeflicks_state_v1";
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("swipeflicks_darkmode");
    return saved ? JSON.parse(saved) : false;
  });

  // Function to fetch top rated movies from TMDB
  const fetchTopRatedMovies = async () => {
    try {
      console.log('Fetching movies from TMDB...');
      const allMovies = [];
      
      // Try to fetch just the first page first to test the API
      const testResponse = await fetch(`https://api.themoviedb.org/3/movie/top_rated?api_key=d9b9ed074847fbc46cffd0144177f7dc&language=en-US&page=1&include_adult=false`);
      
      if (!testResponse.ok) {
        throw new Error(`TMDB API error: ${testResponse.status} ${testResponse.statusText}`);
      }
      
      const testData = await testResponse.json();
      console.log('TMDB API test successful, total pages available:', testData.total_pages);
      
      // Fetch top rated movies (up to 1000 movies, 50 movies per page, 20 pages max)
      const maxPages = Math.min(testData.total_pages || 20, 20);
      
      for (let page = 1; page <= maxPages; page++) {
        console.log(`Fetching page ${page}/${maxPages}...`);
        const response = await fetch(`https://api.themoviedb.org/3/movie/top_rated?api_key=d9b9ed074847fbc46cffd0144177f7dc&language=en-US&page=${page}&include_adult=false`);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
          const movies = data.results.map(movie => ({
            id: movie.id.toString(),
            title: movie.title,
            poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
            year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
            rating: movie.vote_average
          }));
          allMovies.push(...movies);
          console.log(`Added ${movies.length} movies from page ${page}, total: ${allMovies.length}`);
        } else {
          console.log(`No results on page ${page}, breaking early`);
          break;
        }
        
        // Add a small delay to avoid rate limiting
        if (page < maxPages) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log(`Successfully fetched ${allMovies.length} movies from TMDB`);
      
      // Shuffle the movies randomly
      const shuffledMovies = allMovies.sort(() => Math.random() - 0.5);
      
      return shuffledMovies;
    } catch (error) {
      console.error('Error fetching top rated movies from TMDB:', error);
      console.log('Falling back to sample movies...');
      
      // Fallback to sample movies if API fails
      const fallbackMovies = [
        { id: "1", title: "The Grand Budapest Hotel", poster: "https://image.tmdb.org/t/p/w500/1.jpg", year: 2014, rating: 8.1 },
        { id: "2", title: "Inception", poster: "https://image.tmdb.org/t/p/w500/2.jpg", year: 2010, rating: 8.8 },
        { id: "3", title: "Parasite", poster: "https://image.tmdb.org/t/p/w500/3.jpg", year: 2019, rating: 8.6 },
        { id: "4", title: "Spirited Away", poster: "https://image.tmdb.org/t/p/w500/4.jpg", year: 2001, rating: 8.6 },
        { id: "5", title: "La La Land", poster: "https://image.tmdb.org/t/p/w500/5.jpg", year: 2016, rating: 8.0 },
        { id: "6", title: "The Shawshank Redemption", poster: "https://image.tmdb.org/t/p/w500/6.jpg", year: 1994, rating: 9.3 },
        { id: "7", title: "Pulp Fiction", poster: "https://image.tmdb.org/t/p/w500/7.jpg", year: 1994, rating: 8.9 },
        { id: "8", title: "The Dark Knight", poster: "https://image.tmdb.org/t/p/w500/8.jpg", year: 2008, rating: 9.0 },
        { id: "9", title: "Fight Club", poster: "https://image.tmdb.org/t/p/w500/9.jpg", year: 1999, rating: 8.8 },
        { id: "10", title: "Forrest Gump", poster: "https://image.tmdb.org/t/p/w500/10.jpg", year: 1994, rating: 8.8 }
      ];
      
      return fallbackMovies;
    }
  };

  const loadState = async () => {
    try {
      console.log('Loading state...');
      const raw = localStorage.getItem(STORAGE_KEY);
      
      if (!raw) {
        console.log('No saved state found, fetching fresh movies from TMDB...');
        const freshMovies = await fetchTopRatedMovies();
        return { movies: freshMovies, votes: { userA: [], userB: [] }, lastFetched: Date.now() };
      }
      
      const parsed = JSON.parse(raw);
      console.log('Found saved state with', parsed.movies?.length || 0, 'movies');
      
      // Check if we need to refresh movies (e.g., on page refresh)
      const shouldRefresh = !parsed.lastFetched || 
        (Date.now() - parsed.lastFetched) > (24 * 60 * 60 * 1000); // 24 hours
      
      if (shouldRefresh) {
        console.log('State is old, refreshing movies...');
        const freshMovies = await fetchTopRatedMovies();
        return { 
          movies: freshMovies, 
          votes: parsed.votes || { userA: [], userB: [] },
          lastFetched: Date.now()
        };
      }
      
      // If we have movies in storage, use them
      if (parsed.movies && parsed.movies.length > 0) {
        console.log('Using saved movies from storage');
        return {
          movies: parsed.movies,
          votes: parsed.votes || { userA: [], userB: [] },
          lastFetched: parsed.lastFetched
        };
      }
      
      // If no movies in storage, fetch fresh ones
      console.log('No movies in storage, fetching fresh ones...');
      const freshMovies = await fetchTopRatedMovies();
      return { 
        movies: freshMovies, 
        votes: parsed.votes || { userA: [], userB: [] }, 
        lastFetched: Date.now() 
      };
      
    } catch (e) {
      console.warn("Failed to load state, fetching fresh movies.", e);
      const freshMovies = await fetchTopRatedMovies();
      return { movies: freshMovies, votes: { userA: [], userB: [] }, lastFetched: Date.now() };
    }
  };

  const [movies, setMovies] = useState([]);
  const [votes, setVotes] = useState({ userA: [], userB: [] });
  const [currentUser, setCurrentUser] = useState("userA");
  const [lastDirection, setLastDirection] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const [newPoster, setNewPoster] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize movies on component mount
  useEffect(() => {
    const initializeMovies = async () => {
      setIsLoading(true);
      try {
        // Force fresh fetch on app start by clearing old data
        console.log('Clearing old data and fetching fresh movies...');
        localStorage.removeItem(STORAGE_KEY);
        
        const state = await loadState();
        console.log('Initialized with', state.movies.length, 'movies');
        setMovies(state.movies);
        setVotes(state.votes);
      } catch (error) {
        console.error('Failed to initialize movies:', error);
        // Fallback to sample movies if everything fails
        const fallbackMovies = [
          { id: "1", title: "The Grand Budapest Hotel", poster: "https://image.tmdb.org/t/p/w500/1.jpg", year: 2014, rating: 8.1 },
          { id: "2", title: "Inception", poster: "https://image.tmdb.org/t/p/w500/2.jpg", year: 2010, rating: 8.8 },
          { id: "3", title: "Parasite", poster: "https://image.tmdb.org/t/p/w500/3.jpg", year: 2019, rating: 8.6 },
          { id: "4", title: "Spirited Away", poster: "https://image.tmdb.org/t/p/w500/4.jpg", year: 2001, rating: 8.6 },
          { id: "5", title: "La La Land", poster: "https://image.tmdb.org/t/p/w500/5.jpg", year: 2016, rating: 8.0 }
        ];
        setMovies(fallbackMovies);
        setVotes({ userA: [], userB: [] });
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeMovies();
  }, []);

  useEffect(() => {
    const payload = { movies, votes, lastFetched: Date.now() };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn("Failed to save state.", e);
    }
  }, [movies, votes]);

  useEffect(() => {
    localStorage.setItem("swipeflicks_darkmode", JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  // Reset current index when user changes so they see all movies
  useEffect(() => {
    setCurrentIndex(0);
  }, [currentUser]);

  const matches = useMemo(() => {
    const a = new Set(votes.userA || []);
    const b = new Set(votes.userB || []);
    const common = [...a].filter((id) => b.has(id));
    return movies.filter((m) => common.includes(m.id));
  }, [votes, movies]);

  function handleSwipe(direction, movieId) {
    const movie = movies.find(m => m.id === movieId);
    const movieTitle = movie ? movie.title : movieId;
    setLastDirection(direction + " (" + movieTitle + ")");
    if (direction === "right") {
      setVotes((prev) => {
        const copy = { userA: [...(prev.userA || [])], userB: [...(prev.userB || [])] };
        if (!copy[currentUser].includes(movieId)) copy[currentUser].push(movieId);
        return copy;
      });
    } else if (direction === "left") {
      setVotes((prev) => {
        const copy = { userA: [...(prev.userA || [])], userB: [...(prev.userB || [])] };
        copy[currentUser] = copy[currentUser].filter((id) => id !== movieId);
        return copy;
      });
    }
  }

  function addMovie(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const id = Date.now().toString();
    const movie = { id, title: newTitle.trim(), poster: newPoster.trim() };
    setMovies((m) => [movie, ...m]);
    setCurrentIndex(0);
    setNewTitle("");
    setNewPoster("");
  }

  async function resetAll() {
    if (!window.confirm("Reset all movies and votes?")) return;
    setIsLoading(true);
    try {
      const freshMovies = await fetchTopRatedMovies();
      setMovies(freshMovies);
      setVotes({ userA: [], userB: [] });
      setCurrentIndex(0);
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error resetting movies:', error);
      alert('Error resetting movies. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify({ movies, votes }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "swipeflicks_export.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function searchMovies(query) {
    if (!query.trim()) return;
    
    setIsSearching(true);
    try {
      // Using TMDB API (free, no API key required for basic search)
      const response = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=d9b9ed074847fbc46cffd0144177f7dc&query=${encodeURIComponent(query)}&language=en-US&page=1&include_adult=false`);
      const data = await response.json();
      
      if (data.results) {
        const movies = data.results.slice(0, 10).map(movie => ({
          id: movie.id.toString(),
          title: movie.title,
          poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
          year: movie.release_date ? new Date(movie.release_date).getFullYear() : null
        }));
        setSearchResults(movies);
      }
    } catch (error) {
      console.error('Error searching movies:', error);
      alert('Error searching movies. Please try again.');
    } finally {
      setIsSearching(false);
    }
  }

  function addMovieFromSearch(movie) {
    const newMovie = {
      id: Date.now().toString(),
      title: movie.title,
      poster: movie.poster
    };
    setMovies((m) => [newMovie, ...m]);
    setCurrentIndex(0);
    setSearchResults([]);
    setSearchQuery("");
  }

  function importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (parsed.movies) setMovies(parsed.movies);
        if (parsed.votes) setVotes(parsed.votes);
        setCurrentIndex(0);
        alert("Imported!");
      } catch (err) {
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  }

  const remaining = movies.slice(currentIndex);

  function onCardSwiped(direction, movieId) {
    handleSwipe(direction, movieId);
    setTimeout(() => setCurrentIndex((ci) => Math.min(ci + 1, movies.length)), 50);
  }

  function programmaticSwipe(direction) {
    if (remaining.length === 0) return;
    const top = remaining[0];
    handleSwipe(direction, top.id);
    setCurrentIndex((ci) => Math.min(ci + 1, movies.length));
  }

  return (
    <div
      className="min-h-screen p-6 flex flex-col items-center transition-colors duration-200 bg-[#141414] text-white font-sans"
      style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
    >
      <div className="w-full max-w-3xl">
        <header className="flex items-center justify-between mb-6 bg-black px-6 py-4 rounded-lg shadow-lg">
          <h1 className="text-3xl font-bold text-white tracking-tight">SwipeFlicks</h1>
          <div className="flex items-center gap-6">
            <div className="text-sm text-gray-400">
              Two-person movie picker • Local-only
              <br />
              <span className="font-medium text-[#e50914]">
                {currentUser === "userA" ? "You" : "Partner"}: {votes[currentUser]?.length || 0} movies liked
              </span>
            </div>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-full bg-[#e50914] text-white hover:bg-red-700 transition-all duration-300 ease-in-out"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </header>

        <section className="mb-6 flex gap-2 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Current:</label>
            <button
              onClick={() => setCurrentUser("userA")}
              className={`px-3 py-1 rounded font-semibold transition-all duration-300 ease-in-out ${
                currentUser === "userA"
                  ? "bg-[#e50914] text-white hover:bg-red-700"
                  : "bg-transparent border border-white text-white hover:bg-white hover:text-black"
              }`}
            >
              You
            </button>
            <button
              onClick={() => setCurrentUser("userB")}
              className={`px-3 py-1 rounded font-semibold transition-all duration-300 ease-in-out ${
                currentUser === "userB"
                  ? "bg-[#e50914] text-white hover:bg-red-700"
                  : "bg-transparent border border-white text-white hover:bg-white hover:text-black"
              }`}
            >
              Partner
            </button>
          </div>
          <div className="ml-auto flex gap-2">
            <button
              onClick={async () => {
                setIsLoading(true);
                try {
                  const freshMovies = await fetchTopRatedMovies();
                  setMovies(freshMovies);
                  setCurrentIndex(0);
                  alert(`Movies refreshed! Loaded ${freshMovies.length} movies from TMDB.`);
                } catch (error) {
                  console.error('Error refreshing movies:', error);
                  alert('Error refreshing movies. Please try again.');
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
              className={`px-3 py-1 rounded border transition-all duration-300 ease-in-out ${
                isLoading
                  ? 'bg-[#181818] text-gray-400 cursor-not-allowed'
                  : 'border-white text-white bg-transparent hover:bg-white hover:text-black'
              }`}
            >
              {isLoading ? '🔄 Refreshing...' : '🔄 Refresh Movies'}
            </button>
            <button
              onClick={async () => {
                try {
                  const testUrl = 'https://api.themoviedb.org/3/movie/top_rated?api_key=d9b9ed074847fbc46cffd0144177f7dc&language=en-US&page=1&include_adult=false';
                  console.log('Testing TMDB API with URL:', testUrl);
                  const response = await fetch(testUrl);
                  const data = await response.json();
                  console.log('Raw TMDB API response text:', JSON.stringify(data, null, 2));
                  alert(`TMDB API Test: Status ${response.status}, Found ${data.results?.length || 0} movies on page 1`);
                } catch (error) {
                  console.error('TMDB API test failed:', error);
                  alert(`TMDB API test failed: ${error.message}`);
                }
              }}
              className="px-3 py-1 rounded border border-white text-white bg-transparent hover:bg-white hover:text-black transition-all duration-300 ease-in-out"
            >
              🧪 Test API
            </button>
            <button
              onClick={exportJSON}
              className="px-3 py-1 rounded border border-white text-white bg-transparent hover:bg-white hover:text-black transition-all duration-300 ease-in-out"
            >
              Export
            </button>
            <label className="px-3 py-1 rounded border border-white text-white bg-transparent hover:bg-white hover:text-black cursor-pointer transition-all duration-300 ease-in-out">
              Import
              <input type="file" accept="application/json" onChange={importJSON} className="hidden" />
            </label>
            <button
              onClick={resetAll}
              className="px-3 py-1 rounded border border-[#e50914] text-[#e50914] bg-transparent hover:bg-[#e50914] hover:text-white transition-all duration-300 ease-in-out"
            >
              Reset
            </button>
          </div>
        </section>

        <main className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <div className="relative h-96 rounded-lg shadow-lg p-6 flex items-center justify-center overflow-hidden bg-[#181818]">
              {isLoading ? (
                <div className={`flex flex-col items-center gap-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <div>Fetching top 1000 movies from TMDB...</div>
                  <div className="text-sm opacity-75">This may take a few seconds</div>
                </div>
              ) : remaining.length === 0 ? (
                <div className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>No more movies. Add some!</div>
              ) : (
                remaining.map((movie, idx) => {
                  const depth = remaining.length - idx;
                  const isTop = idx === 0;
                  return (
                    <div
                      key={movie.id}
                      style={{
                        position: "absolute",
                        zIndex: depth,
                        left: "50%",
                        top: "50%",
                        transform: `translate(-50%, -50%) scale(${1 - idx * 0.02}) translateY(${idx * 8}px)`,
                        transition: "transform 200ms"
                      }}
                      className="transition-all duration-300 ease-in-out"
                    >
                      <SwipeCard
                        id={movie.id}
                        onSwipe={(dir) => onCardSwiped(dir, movie.id)}
                        onCardLeftScreen={() => {}}
                        disabled={!isTop}
                        className={`w-64 md:w-80 h-48 md:h-64 rounded-lg shadow-lg overflow-hidden flex flex-col bg-[#181818] hover:scale-105 transition-all duration-300 ease-in-out`}
                        style={{ touchAction: "none" }}
                      >
                        <div className="w-full h-full flex flex-col">
                          {movie.poster ? (
                            <img
                              src={movie.poster}
                              alt={movie.title}
                              className="object-cover h-2/3 w-full transition-all duration-300 ease-in-out shadow-md hover:scale-105"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}
                            />
                          ) : (
                            <div className="h-2/3 w-full flex items-center justify-center text-gray-400 bg-[#141414]">No poster</div>
                          )}
                          <div className="p-3 flex items-center justify-between flex-1 bg-[#181818]">
                            <div className="flex-1">
                              <div className="font-semibold text-lg text-white">{movie.title}</div>
                              {movie.year && (
                                <div className="text-xs text-gray-400">{movie.year}</div>
                              )}
                              {movie.rating && (
                                <div className="text-xs text-yellow-400">⭐ {movie.rating}/10</div>
                              )}
                              {votes[currentUser]?.includes(movie.id) && (
                                <div className="text-xs text-green-400 font-medium">✓ You liked this</div>
                              )}
                            </div>
                            <div className="text-sm text-gray-400">Swipe → to like</div>
                          </div>
                        </div>
                      </SwipeCard>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-3 p-3 rounded-lg shadow-lg flex flex-col items-center gap-3 bg-[#181818]">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => programmaticSwipe("left")}
                  className="px-4 py-2 border border-white text-white bg-transparent rounded transition-all duration-300 ease-in-out hover:bg-white hover:text-black"
                >←</button>
                <button
                  onClick={() => programmaticSwipe("right")}
                  className="px-4 py-2 bg-[#e50914] text-white rounded hover:bg-red-700 transition-all duration-300 ease-in-out"
                >→</button>
              </div>

              <form onSubmit={addMovie} className="flex flex-col items-center gap-3 w-full max-w-md">
                <button className="px-6 py-2 bg-[#e50914] text-white rounded hover:bg-red-700 transition-all duration-300 ease-in-out">Add Movie</button>
              </form>

              <div className="w-full max-w-md">
                <div className="flex gap-2 mb-3">
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for real movies..."
                    className="flex-1 border border-[#181818] p-2 rounded bg-[#141414] text-white placeholder-gray-400"
                  />
                  <button
                    onClick={() => searchMovies(searchQuery)}
                    disabled={isSearching}
                    className={`px-4 py-2 rounded transition-all duration-300 ease-in-out ${
                      isSearching
                        ? 'bg-[#181818] text-gray-400 cursor-not-allowed'
                        : 'bg-[#e50914] text-white hover:bg-red-700'
                    }`}
                  >
                    {isSearching ? 'Searching...' : 'Search'}
                  </button>
                </div>
                {searchResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto rounded border border-[#181818] bg-[#181818]">
                    {searchResults.map((movie) => (
                      <div
                        key={movie.id}
                        className="p-2 border-b border-[#181818] last:border-b-0 hover:bg-[#222] cursor-pointer transition-all duration-300 ease-in-out"
                        onClick={() => addMovieFromSearch(movie)}
                      >
                        <div className="flex items-center gap-3">
                          {movie.poster ? (
                            <img src={movie.poster} alt={movie.title} className="w-12 h-16 object-cover rounded shadow" />
                          ) : (
                            <div className="w-12 h-16 rounded flex items-center justify-center text-xs bg-[#222] text-gray-400">No poster</div>
                          )}
                          <div className="flex-1">
                            <div className="font-medium text-white">{movie.title}</div>
                            {movie.year && <div className="text-xs text-gray-400">{movie.year}</div>}
                          </div>
                          <button className="px-2 py-1 text-xs bg-[#e50914] text-white rounded hover:bg-red-700 transition-all duration-300 ease-in-out">Add</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 p-3 rounded-lg shadow-lg bg-[#181818]">
              <div className="text-sm text-gray-400">Last action: {lastDirection || "—"}</div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => setVotes({ ...votes, [currentUser]: [] })}
                  className="px-3 py-1 rounded border border-white text-white bg-transparent hover:bg-white hover:text-black transition-all duration-300 ease-in-out"
                >
                  Clear my likes
                </button>
                <button
                  onClick={() => {
                    const userAVotes = votes.userA?.map(id => movies.find(m => m.id === id)?.title || id) || [];
                    const userBVotes = votes.userB?.map(id => movies.find(m => m.id === id)?.title || id) || [];
                    const voteSummary = {
                      "You liked": userAVotes,
                      "Partner liked": userBVotes
                    };
                    alert(JSON.stringify(voteSummary, null, 2));
                  }}
                  className="px-3 py-1 rounded border border-white text-white bg-transparent hover:bg-white hover:text-black transition-all duration-300 ease-in-out"
                >
                  Show votes
                </button>
              </div>
            </div>
          </div>

          <aside>
            <div className="p-4 rounded-lg shadow-lg mb-4 bg-[#181818]">
              <h2 className="font-semibold mb-2 text-white">Matches ({matches.length})</h2>
              {matches.length === 0 ? (
                <div className="text-sm text-gray-400">No matches yet — keep swiping!</div>
              ) : (
                <ul className="space-y-2">
                  {matches.map((m) => (
                    <li key={m.id} className="flex items-center gap-3">
                      {m.poster ? (
                        <img src={m.poster} alt="" className="w-12 h-16 object-cover rounded shadow" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      ) : (
                        <div className="w-12 h-16 rounded bg-[#222]" />
                      )}
                      <div>
                        <div className="font-medium text-white">{m.title}</div>
                        <div className="text-xs text-[#e50914]">Both liked</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="p-4 rounded-lg shadow-lg mb-4 bg-[#181818]">
              <h3 className="font-semibold mb-2 text-white">Quick stats</h3>
              <div className="text-sm text-gray-300">You liked: {(votes.userA || []).length}</div>
              <div className="text-sm text-gray-300">Partner liked: {(votes.userB || []).length}</div>
              <div className="text-sm text-gray-300">Movies from TMDB: {movies.length}</div>
              <div className="text-xs text-gray-400">Top 1000 rated movies</div>
            </div>
            <div className="p-4 rounded-lg shadow-lg bg-[#181818]">
              <h3 className="font-semibold mb-2 text-white">Movie list</h3>
              <div className="max-h-64 overflow-auto">
                <ul className="space-y-2 text-sm">
                  {movies.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium text-white">{m.title}</div>
                        <div className="flex items-center gap-2 text-xs opacity-75 text-gray-400">
                          {m.year && <span>{m.year}</span>}
                          {m.rating && <span>⭐ {m.rating}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setMovies((arr) => arr.filter(x => x.id !== m.id))}
                          className="px-2 py-1 border border-[#e50914] text-[#e50914] rounded text-xs bg-transparent hover:bg-[#e50914] hover:text-white transition-all duration-300 ease-in-out"
                        >Delete</button>
                        <button
                          onClick={() => { const t = prompt('Edit title', m.title); if (t != null) { setMovies(ms => ms.map(mm => mm.id === m.id ? { ...mm, title: t } : mm)) } }}
                          className="px-2 py-1 border border-white text-white rounded text-xs bg-transparent hover:bg-white hover:text-black transition-all duration-300 ease-in-out"
                        >Edit</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        </main>

        <footer className="mt-6 text-sm text-gray-400">Tip: Switch user to let your partner swipe — matches update when both like the same movie.</footer>
      </div>
    </div>
  );
}
