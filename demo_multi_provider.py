"""
Demo script showing multi-provider LLM architecture usage
"""
from dotenv import load_dotenv
from finder_system.llm_orchestrator import create_orchestrator, ProviderStrategy
from finder_system.llm_extractor import ClaudeAdapter, GeminiAdapter, OllamaAdapter

load_dotenv()

def demo_auto_configuration():
    """Demo 1: Auto-configuration with available providers"""
    print("\n" + "="*60)
    print("Demo 1: Auto-Configuration")
    print("="*60)

    # Orchestrator auto-detects and configures available providers
    orchestrator = create_orchestrator(strategy="failover")

    # Print status
    orchestrator.print_status()


def demo_manual_configuration():
    """Demo 2: Manual provider configuration"""
    print("\n" + "="*60)
    print("Demo 2: Manual Configuration")
    print("="*60)

    # Initialize specific providers
    providers = []

    # Try Claude
    claude = ClaudeAdapter()
    if claude.is_available():
        providers.append(claude)
        print(f"✓ Added Claude (token limit: {claude.get_token_limit():,})")

    # Try Gemini
    gemini = GeminiAdapter()
    if gemini.is_available():
        providers.append(gemini)
        print(f"✓ Added Gemini (token limit: {gemini.get_token_limit():,})")

    # Try Ollama
    ollama = OllamaAdapter(model="llama3.1")
    if ollama.is_available():
        providers.append(ollama)
        print(f"✓ Added Ollama (token limit: {ollama.get_token_limit():,})")

    if providers:
        from finder_system.llm_orchestrator import LLMOrchestrator
        orchestrator = LLMOrchestrator(
            providers=providers,
            strategy=ProviderStrategy.COST_OPTIMIZED
        )
        print(f"\nCreated orchestrator with {len(providers)} providers")
    else:
        print("\nNo providers available. Please configure API keys or start Ollama.")


def demo_provider_capabilities():
    """Demo 3: Check provider capabilities"""
    print("\n" + "="*60)
    print("Demo 3: Provider Capabilities")
    print("="*60)

    providers = [
        ("Claude", ClaudeAdapter()),
        ("Gemini", GeminiAdapter()),
        ("Ollama", OllamaAdapter()),
    ]

    for name, provider in providers:
        print(f"\n{name}:")
        print(f"  Available: {provider.is_available()}")
        print(f"  Provider Name: {provider.get_provider_name()}")
        print(f"  Token Limit: {provider.get_token_limit():,}")

        if hasattr(provider, 'model'):
            print(f"  Model: {provider.model}")
        elif hasattr(provider, 'model_name'):
            print(f"  Model: {provider.model_name}")


def demo_extraction_example():
    """Demo 4: Simple extraction example"""
    print("\n" + "="*60)
    print("Demo 4: Simple Extraction")
    print("="*60)

    # Sample agricultural text
    sample_text = """
    Rice (Oryza sativa) is a staple cereal crop grown extensively in tropical
    and subtropical regions. It thrives in clay and loam soils with a pH range
    of 6.0-7.0. The crop requires warm temperatures between 20-35°C and abundant
    rainfall of 1500-2000mm during the growing season.

    Common pests include rice blast disease and brown planthopper, which can
    significantly reduce yields. Farmers typically transplant seedlings during
    the rainy season (June-July) in regions like Davao, Philippines. Expected
    yields range from 4-5 tons per hectare with proper management practices.
    """

    # Create orchestrator
    orchestrator = create_orchestrator(strategy="performance")

    if not orchestrator.get_available_providers():
        print("No providers available. Please configure at least one provider.")
        return

    print(f"\nExtracting information from sample text...")
    print(f"Text length: {len(sample_text)} characters\n")

    # Create a mock chunk
    chunks = [{'chunk_id': 0, 'text': sample_text, 'token_count': 200}]

    # Extract
    result = orchestrator.extract_from_chunks(chunks, combine_results=True)

    if result.success:
        print(f"✓ Extraction successful!")
        print(f"  Provider used: {result.provider.upper()}")
        print(f"  Chunks processed: {result.total_chunks_processed}")

        data = result.data

        if data.get('crops'):
            print(f"\nCrops found:")
            for crop in data['crops']:
                print(f"  - {crop.get('name', 'Unknown')}")

        if data.get('soil_types'):
            print(f"\nSoil types: {', '.join(data['soil_types'])}")

        if data.get('climate_conditions', {}).get('temperature_range'):
            print(f"\nTemperature: {data['climate_conditions']['temperature_range']}")

        if data.get('recommendations'):
            print(f"\nRecommendations:")
            for rec in data['recommendations'][:3]:
                print(f"  - {rec}")
    else:
        print(f"✗ Extraction failed: {result.error}")


def demo_strategies():
    """Demo 5: Different strategies"""
    print("\n" + "="*60)
    print("Demo 5: Strategy Comparison")
    print("="*60)

    strategies = [
        ("failover", "Try providers in order until success"),
        ("round_robin", "Rotate through providers evenly"),
        ("cost_optimized", "Use cheapest provider first"),
        ("performance", "Use best quality provider first"),
    ]

    for strategy, description in strategies:
        print(f"\n{strategy.upper()}:")
        print(f"  Description: {description}")

        orchestrator = create_orchestrator(strategy=strategy)
        available = len(orchestrator.get_available_providers())
        print(f"  Available providers: {available}")


def main():
    """Run all demos"""
    print("\n" + "="*70)
    print(" "*15 + "Multi-Provider LLM Demo")
    print("="*70)

    demos = [
        ("Auto Configuration", demo_auto_configuration),
        ("Manual Configuration", demo_manual_configuration),
        ("Provider Capabilities", demo_provider_capabilities),
        ("Extraction Example", demo_extraction_example),
        ("Strategy Comparison", demo_strategies),
    ]

    for i, (name, demo_func) in enumerate(demos, 1):
        try:
            demo_func()
        except Exception as e:
            print(f"\nDemo {i} error: {e}")

        # Pause between demos
        if i < len(demos):
            input("\nPress Enter to continue to next demo...")

    print("\n" + "="*70)
    print("Demo completed!")
    print("="*70 + "\n")


if __name__ == '__main__':
    main()
