"""
LLM Orchestrator
Manages multiple LLM providers with fallback and load balancing
"""
from typing import List, Dict, Optional
from enum import Enum

from .llm_extractor import (
    LLMExtractorInterface,
    ChunkExtractionResult,
    ClaudeAdapter,
    GeminiAdapter,
    OllamaAdapter
)


class ProviderStrategy(Enum):
    """Strategy for selecting LLM providers"""
    FAILOVER = "failover"  # Try providers in order until one succeeds
    ROUND_ROBIN = "round_robin"  # Distribute load across available providers
    COST_OPTIMIZED = "cost_optimized"  # Use cheapest available provider first
    PERFORMANCE = "performance"  # Use fastest/best provider first


class LLMOrchestrator:
    """
    Orchestrates multiple LLM providers with automatic failover
    and load balancing capabilities
    """

    def __init__(
        self,
        providers: Optional[List[LLMExtractorInterface]] = None,
        strategy: ProviderStrategy = ProviderStrategy.FAILOVER,
        auto_configure: bool = True
    ):
        """
        Initialize the LLM orchestrator

        Args:
            providers: List of LLM adapter instances
            strategy: Strategy for selecting providers
            auto_configure: Automatically configure available providers
        """
        self.providers: List[LLMExtractorInterface] = providers or []
        self.strategy = strategy
        self.current_provider_index = 0

        # Provider priority (for cost and performance strategies)
        self.provider_priority = {
            'cost_optimized': ['ollama', 'gemini', 'claude'],
            'performance': ['claude', 'gemini', 'ollama']
        }

        if auto_configure and not providers:
            self._auto_configure_providers()

    def _auto_configure_providers(self):
        """Automatically configure available providers based on environment"""
        print("Auto-configuring LLM providers...")

        # Try to initialize Claude
        try:
            claude = ClaudeAdapter()
            if claude.is_available():
                self.providers.append(claude)
                print(f"  ✓ Claude configured (model: {claude.model})")
            else:
                print("  ✗ Claude not available (missing API key)")
        except Exception as e:
            print(f"  ✗ Claude initialization failed: {e}")

        # Try to initialize Gemini
        try:
            gemini = GeminiAdapter()
            if gemini.is_available():
                self.providers.append(gemini)
                print(f"  ✓ Gemini configured (model: {gemini.model_name})")
            else:
                print("  ✗ Gemini not available (missing API key)")
        except Exception as e:
            print(f"  ✗ Gemini initialization failed: {e}")

        # Try to initialize Ollama
        try:
            ollama = OllamaAdapter()
            if ollama.is_available():
                self.providers.append(ollama)
                print(f"  ✓ Ollama configured (model: {ollama.model})")
            else:
                print("  ✗ Ollama not available (service not running)")
        except Exception as e:
            print(f"  ✗ Ollama initialization failed: {e}")

        if not self.providers:
            print("\n⚠️  Warning: No LLM providers available!")
            print("Please configure at least one provider:")
            print("  - Claude: Set ANTHROPIC_API_KEY environment variable")
            print("  - Gemini: Set GOOGLE_API_KEY environment variable")
            print("  - Ollama: Install and start Ollama service")

    def add_provider(self, provider: LLMExtractorInterface):
        """
        Add a provider to the orchestrator

        Args:
            provider: LLM adapter instance
        """
        if provider.is_available():
            self.providers.append(provider)
            print(f"Added provider: {provider.get_provider_name()}")
        else:
            print(f"Provider {provider.get_provider_name()} is not available")

    def get_available_providers(self) -> List[LLMExtractorInterface]:
        """
        Get list of currently available providers

        Returns:
            List of available provider instances
        """
        return [p for p in self.providers if p.is_available()]

    def _get_next_provider(self) -> Optional[LLMExtractorInterface]:
        """
        Get the next provider based on the configured strategy

        Returns:
            Next provider to use, or None if none available
        """
        available = self.get_available_providers()

        if not available:
            return None

        if self.strategy == ProviderStrategy.FAILOVER:
            # Return first available provider
            return available[0]

        elif self.strategy == ProviderStrategy.ROUND_ROBIN:
            # Rotate through available providers
            provider = available[self.current_provider_index % len(available)]
            self.current_provider_index += 1
            return provider

        elif self.strategy == ProviderStrategy.COST_OPTIMIZED:
            # Sort by cost priority
            priority = self.provider_priority['cost_optimized']
            for provider_name in priority:
                for provider in available:
                    if provider.get_provider_name() == provider_name:
                        return provider
            return available[0]

        elif self.strategy == ProviderStrategy.PERFORMANCE:
            # Sort by performance priority
            priority = self.provider_priority['performance']
            for provider_name in priority:
                for provider in available:
                    if provider.get_provider_name() == provider_name:
                        return provider
            return available[0]

        return available[0]

    def extract_from_chunks(
        self,
        chunks: List[Dict],
        combine_results: bool = True,
        max_retries: int = 2
    ) -> ChunkExtractionResult:
        """
        Extract information from chunks using available providers

        Args:
            chunks: List of text chunks
            combine_results: Whether to combine results
            max_retries: Maximum number of provider failovers

        Returns:
            ChunkExtractionResult object
        """
        available_providers = self.get_available_providers()

        if not available_providers:
            return ChunkExtractionResult(
                success=False,
                error="No LLM providers available. Please configure at least one provider.",
                provider="none"
            )

        # Try providers with failover
        attempts = 0
        last_error = None

        while attempts <= max_retries:
            provider = self._get_next_provider()

            if not provider:
                break

            print(f"\nUsing provider: {provider.get_provider_name().upper()}")

            try:
                result = provider.extract_from_chunks(chunks, combine_results)

                if result.success:
                    return result
                else:
                    last_error = result.error
                    print(f"Provider {provider.get_provider_name()} failed: {last_error}")

                    # If using failover strategy, try next provider
                    if self.strategy == ProviderStrategy.FAILOVER:
                        # Remove failed provider temporarily
                        if provider in self.providers:
                            self.providers.remove(provider)
                        attempts += 1
                    else:
                        break

            except Exception as e:
                last_error = str(e)
                print(f"Provider {provider.get_provider_name()} error: {e}")
                attempts += 1

        # All providers failed
        return ChunkExtractionResult(
            success=False,
            error=f"All providers failed. Last error: {last_error}",
            provider="multiple"
        )

    def get_status(self) -> Dict:
        """
        Get status of all configured providers

        Returns:
            Dictionary with provider status information
        """
        status = {
            'total_providers': len(self.providers),
            'available_providers': len(self.get_available_providers()),
            'strategy': self.strategy.value,
            'providers': []
        }

        for provider in self.providers:
            status['providers'].append({
                'name': provider.get_provider_name(),
                'available': provider.is_available(),
                'token_limit': provider.get_token_limit(),
                'model': getattr(provider, 'model', None) or getattr(provider, 'model_name', 'unknown')
            })

        return status

    def print_status(self):
        """Print formatted status of all providers"""
        status = self.get_status()

        print("\n" + "="*60)
        print("LLM Orchestrator Status")
        print("="*60)
        print(f"Strategy: {status['strategy']}")
        print(f"Total Providers: {status['total_providers']}")
        print(f"Available: {status['available_providers']}")
        print("\nProviders:")

        for p in status['providers']:
            status_icon = "✓" if p['available'] else "✗"
            print(f"  {status_icon} {p['name'].upper()}")
            print(f"      Model: {p['model']}")
            print(f"      Token Limit: {p['token_limit']:,}")
            print(f"      Status: {'Available' if p['available'] else 'Not Available'}")

        print("="*60 + "\n")


def create_orchestrator(
    strategy: str = "failover",
    claude_api_key: Optional[str] = None,
    gemini_api_key: Optional[str] = None,
    ollama_model: str = "llama3.1",
    ollama_url: str = "http://localhost:11434"
) -> LLMOrchestrator:
    """
    Factory function to create a configured LLM orchestrator

    Args:
        strategy: Provider selection strategy
        claude_api_key: Anthropic API key (optional)
        gemini_api_key: Google API key (optional)
        ollama_model: Ollama model name
        ollama_url: Ollama service URL

    Returns:
        Configured LLMOrchestrator instance
    """
    strategy_enum = ProviderStrategy(strategy)

    providers = []

    # Initialize providers
    if claude_api_key:
        claude = ClaudeAdapter(api_key=claude_api_key)
        if claude.is_available():
            providers.append(claude)

    if gemini_api_key:
        gemini = GeminiAdapter(api_key=gemini_api_key)
        if gemini.is_available():
            providers.append(gemini)

    # Always try Ollama (local, no API key needed)
    ollama = OllamaAdapter(model=ollama_model, base_url=ollama_url)
    if ollama.is_available():
        providers.append(ollama)

    # If no providers configured, auto-configure
    if not providers:
        orchestrator = LLMOrchestrator(strategy=strategy_enum, auto_configure=True)
    else:
        orchestrator = LLMOrchestrator(providers=providers, strategy=strategy_enum)

    return orchestrator
