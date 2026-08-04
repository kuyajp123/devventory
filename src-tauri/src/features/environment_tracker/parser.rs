use std::io::BufRead;

use super::error::EnvironmentError;
use super::model::{ParseIssue, ParsedEnvironmentFile, ParsedOccurrence};

const INVALID_KEY_MESSAGE: &str = "The assignment uses an invalid environment key name.";
const UNSUPPORTED_SYNTAX_MESSAGE: &str = "The line uses unsupported environment-file syntax.";

pub(super) fn parse_reader(
    mut reader: impl BufRead,
) -> Result<ParsedEnvironmentFile, EnvironmentError> {
    let mut parsed = ParsedEnvironmentFile::default();
    let mut line = Vec::new();
    let mut line_number = 0_u32;

    loop {
        line.clear();
        let bytes_read = reader.read_until(b'\n', &mut line)?;
        if bytes_read == 0 {
            break;
        }
        line_number = line_number
            .checked_add(1)
            .ok_or(EnvironmentError::InvalidInput)?;
        while matches!(line.last(), Some(b'\n' | b'\r')) {
            line.pop();
        }
        let text = std::str::from_utf8(&line).map_err(|_| EnvironmentError::UnsupportedEncoding)?;
        parse_line(text, line_number, &mut parsed);
    }

    Ok(parsed)
}

fn parse_line(text: &str, line_number: u32, parsed: &mut ParsedEnvironmentFile) {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return;
    }

    let (candidate, commented) = match trimmed.strip_prefix('#') {
        Some(comment) => {
            let candidate = comment.trim_start();
            if !looks_like_assignment(candidate) {
                return;
            }
            (candidate, true)
        }
        None => (trimmed, false),
    };

    let candidate = candidate
        .strip_prefix("export ")
        .map(str::trim_start)
        .unwrap_or(candidate);
    let Some((raw_key, _ignored_value)) = candidate.split_once('=') else {
        parsed.issues.push(ParseIssue {
            line_number,
            issue_code: "unsupported_syntax",
            message: UNSUPPORTED_SYNTAX_MESSAGE,
        });
        return;
    };
    let key = raw_key.trim();
    if !is_valid_key(key) {
        parsed.issues.push(ParseIssue {
            line_number,
            issue_code: "invalid_key",
            message: INVALID_KEY_MESSAGE,
        });
        return;
    }

    parsed.occurrences.push(ParsedOccurrence {
        key_name: key.to_owned(),
        normalized_name: key.to_ascii_uppercase(),
        line_number,
        commented,
    });
}

fn looks_like_assignment(candidate: &str) -> bool {
    candidate.contains('=')
        || candidate
            .strip_prefix("export ")
            .is_some_and(|value| value.contains('='))
}

fn is_valid_key(key: &str) -> bool {
    let mut characters = key.chars();
    let Some(first) = characters.next() else {
        return false;
    };
    (first == '_' || first.is_ascii_alphabetic())
        && characters.all(|character| character == '_' || character.is_ascii_alphanumeric())
}

#[cfg(test)]
mod tests {
    use std::io::Cursor;

    use super::parse_reader;
    use crate::features::environment_tracker::error::EnvironmentError;

    #[test]
    fn parses_common_syntax_without_retaining_values() {
        let input = concat!(
            "# heading\n",
            " SUPABASE_URL = https://example.invalid/path?a=b \n",
            "SUPABASE_ANON_KEY=secret-value\n",
            "EMPTY=\n",
            "export QUOTED=\"still-secret\"\n",
            "# COMMENTED_OUT=hidden\n",
            "NO_TRAILING_NEWLINE=value"
        );
        let parsed = parse_reader(Cursor::new(input.as_bytes())).expect("safe parse");
        let keys = parsed
            .occurrences
            .iter()
            .map(|occurrence| occurrence.key_name.as_str())
            .collect::<Vec<_>>();
        assert_eq!(
            keys,
            [
                "SUPABASE_URL",
                "SUPABASE_ANON_KEY",
                "EMPTY",
                "QUOTED",
                "COMMENTED_OUT",
                "NO_TRAILING_NEWLINE"
            ]
        );
        assert!(parsed.occurrences[4].commented);
        let debug = format!("{parsed:?}");
        assert!(!debug.contains("secret-value"));
        assert!(!debug.contains("still-secret"));
        assert!(!debug.contains("example.invalid"));
    }

    #[test]
    fn reports_only_sanitized_issues() {
        let input = "1INVALID=secret\nnot-an-assignment\n";
        let parsed = parse_reader(Cursor::new(input.as_bytes())).expect("safe issues");
        assert!(parsed.occurrences.is_empty());
        assert_eq!(parsed.issues.len(), 2);
        let serialized = serde_json::to_string(&parsed.issues).expect("safe serialization");
        assert!(!serialized.contains("secret"));
        assert!(!serialized.contains("not-an-assignment"));
    }

    #[test]
    fn rejects_invalid_utf8_without_echoing_bytes() {
        let error = parse_reader(Cursor::new([0xff, b'=', b'x']))
            .expect_err("invalid UTF-8 must fail safely");
        assert!(matches!(error, EnvironmentError::UnsupportedEncoding));
    }

    #[test]
    fn repeated_keys_remain_distinct_occurrences_for_duplicate_detection() {
        let parsed =
            parse_reader(Cursor::new(b"TOKEN=one\nTOKEN=two\n")).expect("duplicate metadata parse");
        assert_eq!(parsed.occurrences.len(), 2);
        assert_eq!(parsed.occurrences[0].normalized_name, "TOKEN");
        assert_eq!(parsed.occurrences[1].normalized_name, "TOKEN");
    }
}
