CREATE INDEX IF NOT EXISTS idx_station_votes_id ON station(votes DESC, id ASC);
CREATE INDEX IF NOT EXISTS idx_languages_count_id ON languages(stationcount DESC, id ASC);
CREATE INDEX IF NOT EXISTS idx_tags_count_id ON tags(stationcount DESC, id ASC);
CREATE INDEX IF NOT EXISTS idx_countries_count_id ON countries(stationcount DESC, id ASC);
