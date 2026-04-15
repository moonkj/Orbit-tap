#!/usr/bin/env ruby
# Toggle extension embedding on/off for build testing
require 'xcodeproj'

action = ARGV[0] || 'disable'
project_path = File.join(__dir__, '..', 'ios', 'Runner.xcodeproj')
project = Xcodeproj::Project.open(project_path)

runner = project.targets.find { |t| t.name == 'Runner' }

# Find the Embed App Extensions build phase
embed_phase = runner.build_phases.find { |p|
  p.is_a?(Xcodeproj::Project::Object::PBXCopyFilesBuildPhase) &&
  p.name == 'Embed App Extensions'
}

# Find the dependency on SwiftSafariExtension
ext_dep = runner.dependencies.find { |d| d.name == 'SwiftSafariExtension' || d.target&.name == 'SwiftSafariExtension' }

if action == 'disable'
  # Remove embed phase (don't delete target, just stop embedding)
  if embed_phase
    runner.build_phases.delete(embed_phase)
    puts "Removed 'Embed App Extensions' phase"
  end
  # Remove dependency
  if ext_dep
    runner.dependencies.delete(ext_dep)
    puts "Removed SwiftSafariExtension dependency"
  end
  puts "Extension disabled for build."
elsif action == 'enable'
  puts "To re-enable: run add_extension_target.rb again or use Xcode GUI"
end

project.save
